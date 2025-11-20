import PropTypes from 'prop-types';
// biome-ignore-file: Test fixture with intentional lint violations
import React, { useState } from 'react';

// Functional component with JSX
export function UserCard({ user }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <button onClick={toggleExpanded}>{isExpanded ? 'Collapse' : 'Expand'}</button>
      {isExpanded && (
        <div className="details">
          <p>Email: {user.email}</p>
          <p>Role: {user.role}</p>
        </div>
      )}
    </div>
  );
}

UserCard.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    email: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,
};

// Arrow function component
export const Avatar = ({ src, alt }) => <img src={src} alt={alt} className="avatar" />;

Avatar.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
};

// Helper function (not a component)
export function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`;
}
