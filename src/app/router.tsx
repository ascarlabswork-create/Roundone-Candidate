import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireCandidateAuth } from '../components/auth/RequireCandidateAuth.tsx'
import { CandidateLayout } from '../components/layout/CandidateLayout.tsx'
import { AuthCallbackPage } from '../pages/AuthCallbackPage.tsx'
import { AuthPage } from '../pages/AuthPage.tsx'
import { UpdatePasswordPage } from '../pages/UpdatePasswordPage.tsx'
import { BookPage } from '../pages/BookPage.tsx'
import { CandidateProfilePage } from '../pages/CandidateProfilePage.tsx'
import { ConfirmationPage } from '../pages/ConfirmationPage.tsx'
import { FeedbackPage } from '../pages/FeedbackPage.tsx'
import { ReviewPage } from '../pages/ReviewPage.tsx'
import { FindPage } from '../pages/FindPage.tsx'
import { HomePage } from '../pages/HomePage.tsx'
import { InterviewRoomPage } from '../pages/InterviewRoomPage.tsx'
import { InterviewsPage } from '../pages/InterviewsPage.tsx'
import { MatchesPage } from '../pages/MatchesPage.tsx'
import { NotificationsPage } from '../pages/NotificationsPage.tsx'
import { ProfilePage } from '../pages/ProfilePage.tsx'
import { PracticePage } from '../pages/PracticePage.tsx'
import { ProgressPage } from '../pages/ProgressPage.tsx'
import { SearchPage } from '../pages/SearchPage.tsx'
import {
  InterviewTypesPage,
  NotFoundPage,
  ResourcesPage,
} from '../pages/SupportingPages.tsx'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<CandidateLayout />}>
          <Route path="/candidate/login" element={<AuthPage mode="login" />} />
          <Route path="/candidate/register" element={<AuthPage mode="register" />} />
          <Route path="/candidate/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/candidate/update-password" element={<UpdatePasswordPage />} />
          <Route element={<RequireCandidateAuth />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/candidate/find" element={<FindPage />} />
            <Route path="/candidate/matches" element={<MatchesPage />} />
            <Route path="/candidate/interviewers" element={<SearchPage />} />
            <Route path="/candidate/interviewers/:id" element={<ProfilePage />} />
            <Route path="/candidate/interviewers/:id/book" element={<BookPage />} />
            <Route path="/candidate/interviews" element={<InterviewsPage />} />
            <Route path="/candidate/feedback/:id" element={<FeedbackPage />} />
            <Route path="/candidate/reviews/:id" element={<ReviewPage />} />
            <Route path="/candidate/progress" element={<ProgressPage />} />
            <Route path="/candidate/practice" element={<PracticePage />} />
            <Route path="/candidate/practice/:type" element={<PracticePage />} />
            <Route path="/candidate/interview-types" element={<InterviewTypesPage />} />
            <Route path="/candidate/resources" element={<ResourcesPage />} />
            <Route path="/candidate/notifications" element={<NotificationsPage />} />
            <Route path="/candidate/profile" element={<CandidateProfilePage />} />
            <Route path="/candidate/booking/confirmation" element={<ConfirmationPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route element={<RequireCandidateAuth />}>
          <Route path="/candidate/interview/:id" element={<InterviewRoomPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
