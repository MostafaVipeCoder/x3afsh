import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RefDataProvider } from './context/RefDataContext'
import Header from './components/Header'
import Home from './pages/Home'
import ListingPage from './pages/ListingPage'
import NewListing from './pages/NewListing'
import MyListings from './pages/MyListings'
import Login from './pages/Login'
import Account from './pages/Account'

export default function App() {
  return (
    <AuthProvider>
      <RefDataProvider>
        {/* HashRouter so every link works on GitHub Pages without server rewrites */}
        <HashRouter>
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/listing/:id" element={<ListingPage />} />
              <Route path="/new" element={<NewListing />} />
              <Route path="/edit/:id" element={<NewListing />} />
              <Route path="/my" element={<MyListings />} />
              <Route path="/login" element={<Login />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <footer className="footer">Xعفش — عفش مستعمل بين الناس مباشرة. من غير عمولة.</footer>
        </HashRouter>
      </RefDataProvider>
    </AuthProvider>
  )
}
