import React from 'react';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
// Optional: Vercel Analytics / Speed Insights
// import { inject } from '@vercel/analytics';
// import { SpeedInsights } from '@vercel/speed-insights/react';

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');
const root = createRoot(container);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);


