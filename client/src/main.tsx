import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Editor from './pages/Editor';
import HostSetup from './pages/HostSetup';
import Host from './pages/Host';
import Board from './pages/Board';
import Play from './pages/Play';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/browse', element: <Browse /> },
  { path: '/edit/:id', element: <Editor /> },
  { path: '/host-setup/:gameId', element: <HostSetup /> },
  { path: '/host/:code', element: <Host /> },
  { path: '/board/:code', element: <Board /> },
  { path: '/play', element: <Play /> },
  { path: '/play/:code', element: <Play /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
