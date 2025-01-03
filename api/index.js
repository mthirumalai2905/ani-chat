const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Message = require('./models/Message');
const ws = require('ws');
const fs = require('fs');

dotenv.config();

mongoose.connect(process.env.MONGOURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL,
}));

async function getUserDataFromRequest(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) reject(err);
      resolve(userData);
    });
  });
}

app.get('/test', (req, res) => {
  res.json('test ok');
});

app.get('/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = await getUserDataFromRequest(req);
    if (!userData) {
      return res.status(401).json('Unauthorized');
    }
    const ourUserId = userData.userId;
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: ourUserId },
        { sender: ourUserId, recipient: userId }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json('Error fetching messages');
  }
});

app.get('/people', async (req, res) => {
  try {
    const userData = await getUserDataFromRequest(req);
    if (!userData) {
      return res.status(401).json('Unauthorized');
    }
    
    const users = await User.find({}, {
      _id: 1,
      username: 1,
      createdAt: 1
    });

    const filteredUsers = users.filter(user => 
      user._id.toString() !== userData.userId
    );
    
    res.json(filteredUsers);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json('Error fetching users');
  }
});

app.get('/profile', (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err;
      res.json(userData);
    });
  } else {
    res.status(401).json('no token');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const foundUser = await User.findOne({ username });
    if (!foundUser) {
      return res.status(401).json('User not found');
    }
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (!passOk) {
      return res.status(401).json('Wrong password');
    }
    jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token, { sameSite: 'none', secure: true })
        .status(200)
        .json({ 
          id: foundUser._id,
          username 
        });
    });
  } catch (err) {
    res.status(500).json('Login error');
  }
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json('Username taken');
    }
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({
      username,
      password: hashedPassword,
    });
    jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token, { sameSite: 'none', secure: true })
        .status(201)
        .json({ 
          id: createdUser._id,
          username 
        });
    });
  } catch (err) {
    res.status(500).json('Registration error');
  }
});

app.post('/logout', (req, res) => {
  res.cookie('token', '', { sameSite: 'none', secure: true }).json('ok');
});

const server = app.listen(4000);
const wss = new ws.WebSocketServer({ server });

wss.on('connection', (connection, req) => {
  const notifyOnlinePeople = () => {
    [...wss.clients].forEach(client => {
      const onlinePeople = [...wss.clients]
        .filter(c => c.userId)
        .map(c => ({
          userId: c.userId,
          username: c.username
        }));
      
      client.send(JSON.stringify({
        online: onlinePeople
      }));
    });
  };

  connection.isAlive = true;
  connection.timer = setInterval(() => {
    connection.ping();
    connection.deathTimer = setTimeout(() => {
      connection.isAlive = false;
      clearInterval(connection.timer);
      connection.terminate();
      notifyOnlinePeople();
    }, 1000);
  }, 5000);

  connection.on('pong', () => {
    clearTimeout(connection.deathTimer);
  });

  const cookies = req.headers.cookie;
  if (cookies) {
    const tokenCookie = cookies.split(';').find(str => str.startsWith('token='));
    if (tokenCookie) {
      const token = tokenCookie.split('=')[1];
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) return;
        connection.userId = userData.userId;
        connection.username = userData.username;
      });
    }
  }

  connection.on('message', async (message) => {
    try {
      const messageData = JSON.parse(message.toString());
      const { recipient, text, file } = messageData;
      let filename = null;

      if (file) {
        const parts = file.name.split('.');
        const ext = parts[parts.length - 1];
        filename = Date.now() + '.' + ext;
        const path = __dirname + '/uploads/' + filename;
        const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
        fs.writeFileSync(path, bufferData);
      }

      if (recipient && (text || file)) {
        const messageDoc = await Message.create({
          sender: connection.userId,
          recipient,
          text,
          file: filename,
        });

        // Send to intended recipient
        [...wss.clients]
          .filter(c => c.userId === recipient)
          .forEach(c => c.send(JSON.stringify({
            text,
            sender: connection.userId,
            recipient,
            file: filename,
            _id: messageDoc._id,
          })));

        // Send back to sender
        connection.send(JSON.stringify({
          text,
          sender: connection.userId,
          recipient,
          file: filename,
          _id: messageDoc._id,
        }));
      }
    } catch (err) {
      console.error('Message handling error:', err);
    }
  });

  notifyOnlinePeople();
});