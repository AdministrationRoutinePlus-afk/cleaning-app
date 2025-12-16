# Cleaning App - Planning Notes

## Recent Work Completed (Session: Dec 16, 2025)

### Splash Screen & Branding Update - COMPLETED ✓

**Task**: Add app splash screen and update branding throughout the app

**Changes Made**:

1. **Splash Screen** - Created animated splash screen on app open
   - Component: `/src/components/SplashScreen.tsx`
   - Provider: `/src/components/providers/SplashProvider.tsx`
   - Animation: Framer Motion fade-in + scale (0.95 → 1.0) with subtle glow
   - Duration: 2.5 seconds, then fades out
   - Shows on every app open

2. **Logo Files Added**:
   - `/public/logo-dark.png` - Transparent background logo (Groupe ABR | Routine)
   - `/public/logo-icon.png` - Triangle icon only (for loading spinner)

3. **Login/Register Pages** - Updated logo
   - Changed from `logo.png` to `logo-dark.png`
   - Reduced size for mobile fit (`max-w-[160px]`)
   - Removed "Welcome Back" header text for cleaner mobile view
   - Added spacing between password field and Sign In button

4. **Custom Loading Spinner** - Branded loading component
   - Component: `/src/components/LoadingSpinner.tsx`
   - Uses triangle logo (`logo-icon.png`)
   - Animation: Pulse + Glow effect (Framer Motion)
   - Sizes: `sm`, `md`, `lg`
   - Modes: inline or `fullScreen`

5. **Replaced All Loading States** - Swapped generic spinners for branded loader
   - Employer pages: settings, schedule, users, jobs, history, edit
   - Employee pages: layout, marketplace, jobs, schedule
   - Replaced `Loader2` from lucide-react with `LoadingSpinner`

**Files Created**:
- `/src/components/SplashScreen.tsx`
- `/src/components/providers/SplashProvider.tsx`
- `/src/components/LoadingSpinner.tsx`
- `/public/logo-dark.png`
- `/public/logo-icon.png`

**Files Modified**:
- `/src/app/layout.tsx` - Added SplashProvider
- `/src/app/login/page.tsx` - New logo, cleaner layout
- `/src/app/register/page.tsx` - New logo
- 12+ page files - Replaced loading spinners

---

## Recent Work Completed (Session: Dec 12, 2025)

### Job Card Styling Improvements - COMPLETED ✓

**Task**: Make My Jobs section job cards match the exact styling of Marketplace job cards

**Changes Made**:

1. **Background Image Opacity** - Made consistent across both cards
   - Background layer: `bg-gradient-to-br from-gray-900 to-black opacity-40`
   - Image inside: `opacity-30`
   - Always visible (not conditional)

2. **Brightness Degradation Gradient** - Added to My Jobs cards
   - Layer: `absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent`
   - Creates gradient from solid black at bottom → 60% black middle → transparent top
   - Must use `pointer-events-none` to not block interactions

3. **Info Box Styling** - Made uniform across both cards
   - Duration box: `bg-white/10 backdrop-blur-md rounded-xl border border-white/20`
   - Pay Rate box: `bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40`
   - Time Window box: `bg-white/10 backdrop-blur-md`
   - Location box: `bg-white/10 backdrop-blur-md`
   - All labels: `text-gray-400 text-[10px] uppercase font-bold`
   - All values: `text-white font-bold`

4. **Card Base Background** - Fixed to show gradient properly
   - Card: `!bg-gradient-to-br from-gray-900 via-gray-800 to-black`
   - Used `!` to override default Card component styling

5. **Layer Structure** (bottom to top):
   - Card base: Dark gradient background
   - Background image layer: Always present with `opacity-40` containing image or emoji
   - Brightness degradation overlay: Gradient from black to transparent
   - Content: All UI elements with `relative z-10`

**Key Learning**: The brightness degradation effect requires BOTH the background image layer AND the gradient overlay layer working together. The Card component base must have the dark gradient, and all layers must be properly stacked.

**Files Modified**:
- `/Users/jean-micheldrouin/cleaning-app/src/src/components/employee/MyJobCard.tsx`

---

## Category 1: Easy Visual Upgrades (10 Items)

### 1. Custom Empty State Illustrations
- **Where**: Marketplace (all caught up), My Jobs (empty tabs), Skipped jobs
- **Current**: Simple emoji (🎉, 👀, 🗑️)
- **Upgrade**: Add custom SVG illustrations or branded images for each empty state
- **Effort**: 1-2 hours

### 2. Status Badge Icons
- **Where**: Job cards status badges (CLAIMED, APPROVED, REFUSED, IN_PROGRESS, COMPLETED)
- **Current**: Plain colored text badges
- **Upgrade**: Add small icon inside each badge (⏳ for pending, ✓ for approved, ✕ for refused, etc.)
- **Effort**: 30 minutes

### 3. Swipe Action Visual Feedback
- **Where**: Marketplace swipe cards
- **Current**: Text-only buttons with ✕ and ♥
- **Upgrade**: Add custom animated icons/images that appear during drag (thumbs up/down, or branded icons)
- **Effort**: 1 hour

### 4. Tab Section Headers with Icons
- **Where**: My Jobs page ("Current Jobs" and "Job Status" headers)
- **Current**: Plain text labels
- **Upgrade**: Add small icons next to section headers (📋 for Current Jobs, 📊 for Job Status)
- **Effort**: 15 minutes

### 5. Logo Animation on Login
- **Where**: Login and Register pages
- **Current**: Static logo image
- **Upgrade**: Add subtle pulse or glow animation to the logo
- **Effort**: 30 minutes

### 6. Bottom Navigation Active State Graphics
- **Where**: Bottom navigation bar
- **Current**: Gradient line indicator and icon glow
- **Upgrade**: Add custom shape/badge behind active icon (star burst, circle glow with brand colors)
- **Effort**: 45 minutes

### 7. Custom Loading States - COMPLETED ✓ (Dec 16, 2025)
- **Where**: All pages with Loader2 spinner
- **Current**: ~~Generic spinning circle~~ → Branded triangle logo with pulse + glow
- **Upgrade**: Custom branded loader (logo spin, custom animation, or branded progress indicator)
- **Effort**: 1 hour
- **Component**: `/src/components/LoadingSpinner.tsx`

### 8. Job Card Corner Badges
- **Where**: All job cards (marketplace, my jobs list)
- **Current**: Job code as simple text badge
- **Upgrade**: Add custom shaped corner ribbon or decorative badge with job code
- **Effort**: 45 minutes

### 9. Welcome/Header Personalization
- **Where**: Top of employee pages (Marketplace, My Jobs, etc.)
- **Current**: Simple text header
- **Upgrade**: Add user avatar/initials circle with greeting message and small decorative element
- **Effort**: 1 hour

### 10. Time Window Visual Indicators
- **Where**: Job cards showing time windows
- **Current**: Plain text with clock info
- **Upgrade**: Add visual timeline graphic or clock icon with color-coded time ranges
- **Effort**: 1-1.5 hours

**Total estimated time for all 10**: ~7-9 hours

---

## Category 2: [To be filled]

## Category 3: [To be filled]
