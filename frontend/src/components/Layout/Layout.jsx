import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';

export default function Layout() {
  const { dark } = useTheme();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: dark ? '#0B0F1A' : '#F0F4F8' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
