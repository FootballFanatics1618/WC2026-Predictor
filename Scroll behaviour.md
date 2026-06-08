# Task: Investigate and Fix Scroll Jump After Dropdown Selection

## Context

A user is viewing a long list of match prediction cards.

### Current Behavior

1. User scrolls down to cards that were not initially visible.
2. User opens a prediction dropdown.
3. User selects an option.
4. A loading state appears.
5. The page automatically jumps upward to an earlier card.
6. The issue only occurs when interacting with cards that required scrolling to reach.

### Expected Behavior

After selecting a dropdown value:

* The current scroll position should remain unchanged.
* The selected card should remain visible.
* No automatic scrolling should occur.
* Only the affected card should update.

---

# Investigation Plan

## Step 1: Identify What Triggers After Selection

Trace the entire flow after dropdown selection.

Document:

```text
Dropdown Selection
↓
State Updates
↓
API Calls
↓
Cache Invalidations
↓
Component Renders
↓
Scroll/Focus Changes
```

Determine whether:

* API requests are triggered
* Full page refreshes occur
* Match list refetches occur
* Focus changes occur

Deliverable:

```text
Root cause flow diagram
```

---

## Step 2: Check For Full List Refreshes

Search for patterns such as:

```js
refetchMatches()
invalidateQueries()
refreshPredictions()
getMatches()
setMatches(response)
```

Determine:

* Is the entire matches list being reloaded after every prediction update?
* Is the entire page state being replaced?

Deliverable:

```text
List of refreshes triggered by dropdown selection
```

---

## Step 3: Verify React Keys

Inspect card rendering.

Look for:

```jsx
key={index}
```

or any unstable keys.

Confirm whether cards use:

```jsx
key={match.id}
```

or another stable unique identifier.

Deliverable:

```text
Current key implementation
Recommended key implementation
```

---

## Step 4: Detect Component Remounts

Determine whether MatchCard components are:

* Updating
* Re-rendering
* Fully unmounting and remounting

Use React DevTools and/or temporary logging.

Deliverable:

```text
Component lifecycle observations
```

---

## Step 5: Search For Scroll Logic

Search entire codebase for:

```js
scrollIntoView
scrollTo
window.scroll
scrollTop
```

Determine whether any of these execute after prediction updates.

Deliverable:

```text
List of scroll-related code paths
```

---

## Step 6: Search For Focus Logic

Search for:

```js
.focus()
autoFocus
setFocus
focus()
```

Determine whether focus is restored to another card after updates.

Deliverable:

```text
List of focus-related code paths
```

---

## Step 7: Check Query/Cache Management

If using:

* React Query
* TanStack Query
* SWR
* Apollo

Determine whether dropdown selection triggers:

```js
invalidateQueries()
refetchQueries()
resetQueries()
```

Deliverable:

```text
Cache invalidation flow
```

---

# Fix Strategy

Apply fixes in this order.

---

## Fix 1 (Preferred): Prevent Full List Refresh

If dropdown selection currently causes:

```text
Update Prediction
↓
Refetch Entire Match List
```

Replace with:

```text
Update Prediction
↓
Optimistically Update Affected Match
```

Only update the modified card.

Success criteria:

* No list refresh
* No scroll jump
* Faster UI

---

## Fix 2: Use Stable Keys

Replace any:

```jsx
key={index}
```

with:

```jsx
key={match.id}
```

or equivalent stable identifier.

Success criteria:

* Components update rather than remount
* DOM stability maintained

---

## Fix 3: Remove Unwanted Scroll Operations

If any code automatically executes:

```js
scrollIntoView()
scrollTo()
```

after updates:

* Remove it
* Restrict it to initial page load only

Success criteria:

* No forced viewport movement

---

## Fix 4: Preserve Focus

If focus restoration is triggering browser scrolling:

* Keep focus on current dropdown
* Avoid refocusing parent cards
* Avoid autofocus after update

Success criteria:

* Focus remains local
* No browser auto-scroll

---

## Fix 5: Preserve Scroll Position (Fallback)

If architectural constraints require a refresh:

Capture:

```js
const scrollY = window.scrollY;
```

before update.

Restore:

```js
window.scrollTo(0, scrollY);
```

after update.

Use only if root-cause fixes are not feasible.

---

# Acceptance Criteria

The issue is considered resolved when:

1. User scrolls to any card.
2. User changes dropdown selection.
3. Loading state may appear.
4. Page remains at the same scroll position.
5. Selected card remains visible.
6. No jump to earlier cards occurs.
7. React DevTools shows localized updates rather than full-list remounts.

---

# Expected Deliverables From Agent

1. Root cause analysis.
2. Evidence (logs/screenshots/code references).
3. Identified trigger path.
4. Proposed fix.
5. Implemented fix.
6. Verification recording demonstrating:

   * before behavior
   * after behavior
   * no scroll jump remaining.
