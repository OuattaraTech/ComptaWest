import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.jsx';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cw_token');
    if (token) {
      api.get('/auth/me')
        .then(r => setUser(r.data.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, mot_de_passe) => {
    const { data } = await api.post('/auth/login', { email, mot_de_passe });
    localStorage.setItem('cw_token', data.data.token);
    setUser(data.data.user);
    return data.data;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('cw_token', data.data.token);
    setUser(data.data.user);
    return data.data;
  };

  // Acceptation d'une invitation : définit le mot de passe et connecte l'invité
  const acceptInvitation = async (token, payload) => {
    const { data } = await api.post(`/auth/invitation/${token}`, payload);
    localStorage.setItem('cw_token', data.data.token);
    setUser(data.data.user);
    return data.data;
  };

  // Création d'un compte démo isolé (migration 028) : un user temporaire
  // par visiteur, avec ses propres données, qui expire dans 24 h. Le
  // backend retourne directement le JWT — pas besoin d'un second
  // /auth/login derrière, contrairement à l'ancien comportement.
  const loginDemo = async () => {
    const { data } = await api.post('/auth/demo');
    localStorage.setItem('cw_token', data.data.token);
    setUser(data.data.user);
    return data.data;
  };

  const logout = () => {
    localStorage.removeItem('cw_token');
    localStorage.removeItem('cw_user');
    localStorage.removeItem('cw_entreprise_id');
    delete api.defaults.headers.common['X-Entreprise-Id'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, acceptInvitation, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


