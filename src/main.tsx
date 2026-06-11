import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/styles.css';

// Không bọc StrictMode: app có vòng lặp rAF + Web Speech điều khiển bằng tay,
// double-invoke của StrictMode trong dev dễ gây nhân đôi animation/giọng nói.
createRoot(document.getElementById('root')!).render(<App />);
