import { useState } from 'react';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';

const JoinRoomForm = ({ onSubmit, submitting }) => {
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(roomCode.trim().toUpperCase());
  };

  return (
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
      <Input
        aria-label="Room code"
        className="uppercase"
        placeholder="ROOM CODE"
        value={roomCode}
        onChange={(event) => setRoomCode(event.target.value)}
        minLength={6}
        maxLength={16}
        required
      />
      <Button type="submit" disabled={submitting}>
        Join
      </Button>
    </form>
  );
};

export default JoinRoomForm;
