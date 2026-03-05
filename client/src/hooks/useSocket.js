import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const useSocket = () => {
    const socketRef = useRef(null);

    useEffect(() => {
        socketRef.current = io(SOCKET_SERVER_URL, {
            transports: ['websocket'],
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to socket server');
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    return socketRef.current;
};

export default useSocket;
