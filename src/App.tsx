import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RefDataProvider } from './context/RefDataContext'
import { SurveyProvider } from './context/SurveyContext'
import Header from './components/Header'
import PostContactSurvey from './components/PostContactSurvey'
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

export default function App() {
  return (
    <AuthProvider>
      <RefDataProvider>
        {/* HashRouter so every link works on GitHub Pages without server rewrites */}
        <HashRouter>
          <SurveyProvider>
            <Header />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/listing/:id" element={<ListingPage />} />
                <Route path="/new" element={<NewListing />} />
                <Route path="/edit/:id" element={<NewListing />} />
                <Route path="/my" element={<MyListings />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/negotiation/:id" element={<NegotiationPage />} />
                <Route path="/chat/:id" element={<ChatPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/account" element={<Account />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </main>
            <PostContactSurvey />
            <footer className="footer">Xعفش — عفش مستعمل بين الناس مباشرة. من غير عمولة.</footer>
          </SurveyProvider>
        </HashRouter>
      </RefDataProvider>
    </AuthProvider>
  )
}
