import React, { useState, useEffect, useRef } from 'react';
import { Joystick } from 'react-joystick-component';
import Button from '@mui/material/Button';
import './App.css';
import BLEController from './BLEController';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const bleRef = useRef(null);

  useEffect(() => {
    console.log(isConnected ? 'Connected to Bluetooth' : 'Disconnected to Bluetooth');
  }, [isConnected]);

  function coordinateHandler(coords) {
    setCoordinates(coords);
  }

  const handleConnect = () => {
    if (bleRef.current) {
      bleRef.current.connect();
      setIsConnected(true);
    }
  };

  const handleDisconnect = () => {
    if (bleRef.current) {
      bleRef.current.disconnect();
      setIsConnected(false);
    }
  };

  return (
    <>
      <div className="App">
        <h1>SHREK MOBILE</h1>
        <div className="connections">
          <Button variant="contained" color="secondary" className="Connection" onClick={handleConnect}>
            Connect to Bluetooth
          </Button>
          <Button variant="contained" color="secondary" className="disconnection" onClick={handleDisconnect}>
            Disconnect Bluetooth
          </Button>
        </div>
        <div className="joystick-container">
          <Joystick size={150} baseColor="gray" stickColor="black" move={e => coordinateHandler({ x: e.x, y: e.y })} />
        </div>
      </div>
      <div className="logs">
        <BLEController ref={bleRef} coordinates={coordinates} />
      </div>
    </>
  );
}