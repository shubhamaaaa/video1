import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const userId = window.location.hash.substring(1) || uuidv4();
window.location.hash = userId;

const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const ws = new WebSocket('wss://video1-backend.onrender.com');

function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  const remoteDescSetRef = useRef(false);
  const [targetId, setTargetId] = useState('');
  const [isCaller, setIsCaller] = useState(false);

  useEffect(() => {
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', payload: { userId } }));
    };

    ws.onmessage = async (message) => {
      const { type, payload, from } = JSON.parse(message.data);

      switch (type) {
        case 'offer':
          setIsCaller(false);
          setTargetId(from);
          await handleOffer(payload);
          break;

        case 'answer':
          if (pcRef.current && !pcRef.current.currentRemoteDescription) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
            remoteDescSetRef.current = true;
            flushIceQueue();
          }
          break;

        case 'ice':
          if (remoteDescSetRef.current && pcRef.current) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
            } catch (e) {
              console.warn('Failed to add ICE candidate:', e);
            }
          } else {
            iceCandidateQueue.current.push(payload);
          }
          break;

        default:
          break;
      }
    };
  }, []);

  const flushIceQueue = async () => {
    if (pcRef.current) {
      for (const candidate of iceCandidateQueue.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding queued ICE candidate:', e);
        }
      }
      iceCandidateQueue.current = [];
    }
  };

  const startCall = async () => {
    setIsCaller(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;

    const peer = new RTCPeerConnection(peerConnectionConfig);
    pcRef.current = peer;

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = (e) => {
      if (e.candidate && targetId) {
        ws.send(JSON.stringify({ type: 'ice', payload: e.candidate, to: targetId }));
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: 'offer', payload: offer, to: targetId }));
  };

  const handleOffer = async (offer) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;

    const peer = new RTCPeerConnection(peerConnectionConfig);
    pcRef.current = peer;

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    peer.onicecandidate = (e) => {
      if (e.candidate && targetId) {
        ws.send(JSON.stringify({ type: 'ice', payload: e.candidate, to: targetId }));
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    remoteDescSetRef.current = true;
    await flushIceQueue();

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    ws.send(JSON.stringify({ type: 'answer', payload: answer, to: targetId }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: 20 }}>
      <h1>WebRTC Video Call</h1>
      <input
        placeholder="Enter remote user ID"
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
      />
      <button onClick={startCall} disabled={!targetId}>Start Call</button>
      <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
        <video ref={localVideoRef} autoPlay playsInline muted width="300" />
        <video ref={remoteVideoRef} autoPlay playsInline width="300" />
      </div>
      <p>Your ID: <strong>{userId}</strong></p>
    </div>
  );
}

export default App;
