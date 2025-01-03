import React, { useState, useContext } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UserContext } from './UserContext';

const Login = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { setUsername: setLoggedInUsername, setId, setIsLoggedIn } = useContext(UserContext);

  async function login(ev) {
    ev.preventDefault();
    try {
      const response = await axios.post('http://localhost:4000/login', { username, password });
      toast.success('Successfully Logged In!', { position: 'top-right' });
      setLoggedInUsername(username);
      setId(response.data.id);
      setIsLoggedIn(true); // Set the user as logged in
    } catch (error) {
      toast.error('Login failed. Please try again.', { position: 'top-right' });
    }
  }

  return (
    <div className="bg-gradient-to-r from-teal-400 to-cyan-500 h-screen flex items-center justify-center">
      <div className="form-container w-80 p-6 rounded-lg shadow-xl hover:scale-105 transition-all duration-300 ease-in-out">
        <form className="space-y-4" onSubmit={login}>
          <h2 className="text-3xl font-semibold text-center text-gray-800">Login to Your Account</h2>
          <input
            type="text"
            value={username}
            onChange={ev => setUsername(ev.target.value)}
            placeholder="Username"
            className="w-full p-3 bg-transparent border-2 border-gray-300 rounded-md text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <input
            type="password"
            value={password}
            onChange={ev => setPassword(ev.target.value)}
            placeholder="Password"
            className="w-full p-3 bg-transparent border-2 border-gray-300 rounded-md text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <button
            type="submit"
            className="w-full p-3 bg-teal-500 text-white rounded-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-300">
            Login
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          Don't have an account?{' '}
          <span
            onClick={onSwitchToRegister}
            className="text-teal-500 cursor-pointer hover:text-teal-700">
            Register
          </span>
        </p>
      </div>
      <ToastContainer />
    </div>
  );
};

export default Login;
