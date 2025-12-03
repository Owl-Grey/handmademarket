import './App.css';

import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import SearchPage from './pages/SearchPage';
import ProductPage from './pages/ProductPage';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import SellerPage from './pages/SellerPage';
import ProfilePage from './pages/ProfilePage';
import MobileBottomBar from './components/MobileBottomBar';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/seller/:id" element={<SellerPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>

      {/* Mobile bottom bar rendered at the app root so it always sits at the bottom of the page */}
      <MobileBottomBar />
    </>
  );
}

export default App;
