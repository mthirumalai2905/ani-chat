export default function Avatar({ userId, username, online }) {
    // Default colors for avatar background
    const colors = [
      'bg-teal-200', 'bg-red-200', 'bg-green-200', 'bg-purple-200',
      'bg-blue-200', 'bg-yellow-200', 'bg-orange-200', 'bg-pink-200',
      'bg-fuchsia-200', 'bg-rose-200'
    ];
  
    // Check if userId is valid
    const userIdBase10 = userId && userId.length > 10
      ? parseInt(userId.substring(10), 16)
      : 0;
  
    // Ensure color index is within bounds
    const colorIndex = userIdBase10 % colors.length;
    const color = colors[colorIndex];
  
    // Default online status if undefined
    const isOnline = online === true;
  
    return (
      <div className={`w-8 h-8 relative rounded-full flex items-center ${color}`}>
        <div className="text-center w-full opacity-70">
          {/* Check if username is defined and is a string */}
          {username && username.length > 0 ? username[0] : '?'}
        </div>
        {isOnline ? (
          <div className="absolute w-3 h-3 bg-green-400 bottom-0 right-0 rounded-full border border-white"></div>
        ) : (
          <div className="absolute w-3 h-3 bg-gray-400 bottom-0 right-0 rounded-full border border-white"></div>
        )}
      </div>
    );
  }
  