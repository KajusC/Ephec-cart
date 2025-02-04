import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import styled from "@emotion/styled";

const LogContainer = styled("div")({
  background: "#000000",
  padding: "0.5rem",
  height: "200px",
  borderRadius: "10px",
  overflowY: "scroll",
  scrollbarWidth: "none", // Firefox
  "-ms-overflow-style": "none", // IE 10+
  "&::-webkit-scrollbar": {
    display: "none", // Chrome, Safari, Opera
  },
});

function BLEController(props, ref) {
  const { coordinates } = props;
  const [logs, setLogs] = useState([]);
  const [servoAngle, setServoAngle] = useState(90);
  const [motorSpeed, setMotorSpeed] = useState(0);
  const [directionFlag, setDirectionFlag] = useState(0);
  const deviceCache = useRef(null);
  const characteristicCache = useRef(null);
  const intervalId = useRef(null);

  useEffect(() => {
    //servo motor angle - 0 to 180 degrees. can't be negative
    if (coordinates.x > 0) {
      setServoAngle(Math.round(90 + Math.abs(coordinates.x) * 90, 1));
    } else {
      setServoAngle(Math.round(90 - Math.abs(coordinates.x) * 90, 1));
    }

    //motor speed - 0 to 255. if negative, flag of direction is set to 1
    if (coordinates.y > 0) {
      setMotorSpeed(Math.round(Math.abs(coordinates.y) * 255, 1));
      setDirectionFlag(0);
    } else {
      setMotorSpeed(Math.round(Math.abs(coordinates.y) * 255, 1));
      setDirectionFlag(1);
    }
  }, [coordinates]);

  function log(data, type = "") {
    const message =
      typeof data === "object" ? data.message || data.toString() : data;
    setLogs((prev) => [...prev, { message, type }]);
  }

  function writeToCharacteristic(characteristic, data) {
    characteristic.writeValue(new TextEncoder().encode(data));
  }

  function send(data, doLog = true) {
    data = String(data);
    if (!data || !characteristicCache.current) return;
    data += "\n";
    if (data.length > 20) {
      let chunks = data.match(/(.|[\r\n]){1,20}/g);
      writeToCharacteristic(characteristicCache.current, chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        setTimeout(() => {
          writeToCharacteristic(characteristicCache.current, chunks[i]);
        }, i * 100);
      }
    } else {
      writeToCharacteristic(characteristicCache.current, data);
    }
    if (doLog) {
      log(data, "out");
    }
  }

  function sendingBLEinfo() {
    send(`<R${servoAngle}><M${motorSpeed}>`, true);
  }

  function handleCharacteristicValueChanged(event) {
    const value = new TextDecoder().decode(event.target.value);
    log(value, "in");
  }

  function startNotifications(characteristic) {
    log("Starting notifications...");
    return characteristic.startNotifications().then(() => {
      log("Notifications started");
      characteristic.addEventListener(
        "characteristicvaluechanged",
        handleCharacteristicValueChanged
      );
    });
  }

  function connectDeviceAndCacheCharacteristic(device) {
    if (device.gatt.connected && characteristicCache.current) {
      return Promise.resolve(characteristicCache.current);
    }
    log("Connecting to GATT server...");
    return device.gatt
      .connect()
      .then((server) => {
        log("GATT server connected, getting service...");
        return server.getPrimaryService(0xffe0);
      })
      .then((service) => {
        log("Service found, getting characteristic...");
        return service.getCharacteristic(0xffe1);
      })
      .then((characteristic) => {
        log("Characteristic found");
        characteristicCache.current = characteristic;
        return characteristicCache.current;
      });
  }

  function requestBluetoothDevice() {
    log("Requesting bluetooth device...");
    return navigator.bluetooth
      .requestDevice({
        filters: [{ services: [0xffe0] }],
      })
      .then((device) => {
        log(`"${device.name}" bluetooth device selected`);
        deviceCache.current = device;
        deviceCache.current.addEventListener(
          "gattserverdisconnected",
          handleDisconnection
        );
        return deviceCache.current;
      });
  }

  function handleDisconnection(event) {
    const device = event.target;
    log(
      `"${device.name}" bluetooth device disconnected, trying to reconnect...`
    );
    connectDeviceAndCacheCharacteristic(device)
      .then(startNotifications)
      .catch((error) => log(error));
  }

  function connect() {
    const p = deviceCache.current
      ? Promise.resolve(deviceCache.current)
      : requestBluetoothDevice();
    p.then((device) => connectDeviceAndCacheCharacteristic(device))
      .then((characteristic) => startNotifications(characteristic))
      .then(() => {
        intervalId.current = setInterval(sendingBLEinfo, 100);
      })
      .catch((error) => log(error));
  }

  function disconnect() {
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
    if (deviceCache.current) {
      log(
        `Disconnecting from "${deviceCache.current.name}" bluetooth device...`
      );
      deviceCache.current.removeEventListener(
        "gattserverdisconnected",
        handleDisconnection
      );
      if (deviceCache.current.gatt.connected) {
        deviceCache.current.gatt.disconnect();
        log(`"${deviceCache.current.name}" bluetooth device disconnected`);
      } else {
        log(
          `"${deviceCache.current.name}" bluetooth device is already disconnected`
        );
      }
    }
    if (characteristicCache.current) {
      characteristicCache.current.removeEventListener(
        "characteristicvaluechanged",
        handleCharacteristicValueChanged
      );
      characteristicCache.current = null;
    }
    deviceCache.current = null;
  }

  useEffect(() => {
    return () => {
      if (intervalId.current) clearInterval(intervalId.current);
      disconnect();
    };
  }, []);

  // Expose connect/disconnect to parent via ref
  useImperativeHandle(ref, () => ({
    connect,
    disconnect,
  }));

  return (
    <div style={{ padding: "1rem" }}>
      <h2>BLE Controller</h2>
      <div style={{ marginBottom: "1rem" }}>
        <strong>Servo Angle:</strong> {servoAngle}°
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <strong>Motor Speed:</strong> {motorSpeed}
      </div>
      <div style={{ marginBottom: "1rem" }}>
      <strong>Direction:</strong> {directionFlag === 0 ? "Forward" : "Backward"}
      </div>
      <LogContainer>
        {logs.map((logItem, index) => (
          <div key={index} className={logItem.type}>
            {logItem.message}
          </div>
        ))}
      </LogContainer>
    </div>
  );
}

export default forwardRef(BLEController);
