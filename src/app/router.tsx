import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CandidateLayout } from '../components/layout/CandidateLayout.tsx'
import { BookPage } from '../pages/BookPage.tsx'
import { ConfirmationPage } from '../pages/ConfirmationPage.tsx'
import { FeedbackPage } from '../pages/FeedbackPage.tsx'
import { FindPage } from '../pages/FindPage.tsx'
import { HomePage } from '../pages/HomePage.tsx'
import { InterviewRoomPage } from '../pages/InterviewRoomPage.tsx'
import { InterviewsPage } from '../pages/InterviewsPage.tsx'
import { MatchesPage } from '../pages/MatchesPage.tsx'
import { ProfilePage } from '../pages/ProfilePage.tsx'
import { ProgressPage } from '../pages/ProgressPage.tsx'
import { SearchPage } from '../pages/SearchPage.tsx'
import {
  CandidateProfilePage,
  InterviewTypesPage,
  NotFoundPage,
  NotificationsPage,
  PracticePage,
  ResourcesPage,
} from '../pages/SupportingPages.tsx'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<CandidateLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/candidate/find" element={<FindPage />} />
          <Route path="/candidate/matches" element={<MatchesPage />} />
          <Route path="/candidate/interviewers" element={<SearchPage />} />
          <Route path="/candidate/interviewers/:id" element={<ProfilePage />} />
          <Route path="/candidate/interviewers/:id/book" element={<BookPage />} />
          <Route path="/candidate/booking/confirmation" element={<ConfirmationPage />} />
          <Route path="/candidate/interviews" element={<InterviewsPage />} />
          <Route path="/candidate/feedback/:id" element={<FeedbackPage />} />
          <Route path="/candidate/progress" element={<ProgressPage />} />
          <Route path="/candidate/practice" element={<PracticePage />} />
          <Route path="/candidate/interview-types" element={<InterviewTypesPage />} />
          <Route path="/candidate/resources" element={<ResourcesPage />} />
          <Route path="/candidate/notifications" element={<NotificationsPage />} />
          <Route path="/candidate/profile" element={<CandidateProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/candidate/interview/:id" element={<InterviewRoomPage />} />
      </Routes>
    </BrowserRouter>
  )
}
