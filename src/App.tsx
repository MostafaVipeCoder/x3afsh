import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RefDataProvider } from './context/RefDataContext'
import { SurveyProvider } from './context/SurveyContext'
import { FavoritesProvider } from './context/FavoritesContext'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import PostContactSurvey from './components/PostContactSurvey'
import MicroSurveys from './components/MicroSurveys'
import { NotForOwner, OwnerLanding } from './components/OwnerOnly'
import Favorites from './pages/Favorites'
import Home from './pages/Home'
import ListingPage from './pages/ListingPage'
import NewListing from './pages/NewListing'
import MyListings from './pages/MyListings'
import Login from './pages/Login'
import Account from './pages/Account'
import NegotiationPage from './pages/NegotiationPage'
import ChatPage from './pages/ChatPage'
import Inbox from './pages/Inbox'
import Dashboard from './pages/Dashboard'
import { Terms, Privacy } from './pages/Legal'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RefDataProvider>
          {/* HashRouter so every link works on GitHub Pages without server rewrites */}
          <HashRouter>
            <SurveyProvider>
            <FavoritesProvider>
              <Header />
              <OwnerLanding />
              <main>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/listing/:id" element={<ListingPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    {/* marketplace-only pages */}
                    <Route path="/favorites" element={<NotForOwner><Favorites /></NotForOwner>} />
                    <Route path="/new" element={<NotForOwner><NewListing /></NotForOwner>} />
                    <Route path="/edit/:id" element={<NotForOwner><NewListing /></NotForOwner>} />
                    <Route path="/my" element={<NotForOwner><MyListings /></NotForOwner>} />
                    <Route path="/inbox" element={<NotForOwner><Inbox /></NotForOwner>} />
                    <Route path="/negotiation/:id" element={<NotForOwner><NegotiationPage /></NotForOwner>} />
                    <Route path="/chat/:id" element={<NotForOwner><ChatPage /></NotForOwner>} />
                    <Route path="*" element={<Home />} />
                  </Routes>
                </ErrorBoundary>
              </main>
              <PostContactSurvey />
              <MicroSurveys />
              <footer className="footer">
                Xعفش — عفش مستعمل بين الناس مباشرة. من غير عمولة.
                <div style={{ marginTop: 4 }}><Link to="/terms">شروط الاستخدام</Link> · <Link to="/privacy">سياسة الخصوصية</Link></div>
              </footer>
            </FavoritesProvider>
            </SurveyProvider>
          </HashRouter>
        </RefDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
