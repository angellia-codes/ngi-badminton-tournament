# Product Requirements Document (PRD): Nourish Badminton Tournament App

## 1. Product Overview
**Objective:** To build a web-based application that streamlines participant registration, provides real-time live scoring, and automates a Double-Elimination (Upper/Lower bracket) system for the internal Nourish Badminton Tournament. 

**Goals:**
* Modernize the 2026 employee engagement calendar by replacing manual/paper registrations with a seamless digital experience for staff across all Nourish and Bakery branches.
* Provide a centralized, real-time dashboard for players and spectators to view scores, track their bracket positioning, and follow the tournament's progression.
* Clearly track and display the winners and runner-ups for all four categories.

---

## 2. User Roles
* **Participant:** Employees registering for the tournament.
* **Spectator:** Staff and supporters viewing the public-facing brackets and live scores.
* **Admin / Referee:** The tournament organizers responsible for approving registrations, seeding the initial brackets, and updating live scores during matches.

---

## 3. Core Features

### 3.1. Participant Registration Form
A public-facing form allowing players to sign up for the tournament.

* **Inputs:**
    * **Player Name(s):** Text input (Requires 1 name for Singles, 2 names for Doubles).
    * **Outlet Affiliation (Dropdown):**
        1.  Nourish Ungasan
        2.  Nourish Uluwatu + The Bakery Uluwatu
        3.  Nourish Berawa + The Bakery Kitchen
        4.  BOH + Wholefood
    * **Tournament Category (Dropdown/Radio):**
        1.  Single Man
        2.  Single Woman
        3.  Double Men
        4.  Double Women
* **Validation Rules:** 
    * If a "Double" category is selected, the form *must* mandate a second player's name.
    * Ensure all required fields are filled before form submission.

### 3.2. Double-Elimination Bracket Management
An automated system to track progression through the Upper (Winners) and Lower (Losers) brackets.

* **Initial Seeding (Admin):** Admins generate the first round of matchups in the Upper Bracket.
* **Automated Progression Logic:**
    * **Upper Bracket:** Winners advance to the next round in the Upper Bracket. Losers are automatically dropped into the corresponding round of the Lower Bracket.
    * **Lower Bracket:** Winners advance to the next round in the Lower Bracket. A loss here results in final elimination.
* **Grand Final Logic:** The system must schedule a match between the Upper Bracket Winner and the Lower Bracket Winner. 
    * *Bracket Reset:* If the Lower Bracket Winner wins the first match, the system must automatically generate a second, decisive "Reset" match.
* **Public Bracket View:** A responsive visual tree showing both the Upper and Lower brackets clearly, updating in real-time as matches conclude.

### 3.3. Live Scoring Dashboard
A real-time interface for active matches on the court.

* **Referee Interface (Admin):** 
    * Simple `+1` and `-1` buttons for Player/Team A and Player/Team B.
    * Ability to mark a game/set as complete and formally submit the final match result to trigger the bracket progression.
* **Spectator Interface (Public):**
    * A clean, auto-updating scoreboard displaying the current points and current set.

### 3.4. Leaderboard & Hall of Fame
A dedicated page that populates as the tournament concludes. 

* **Awards Display:** 
    * Displays the **Winner (1st Place)** and **Runner-up (2nd Place)**.
    * Organized by the 4 specific categories:
        * 🏆 Single Man (Winner & Runner-up)
        * 🏆 Single Woman (Winner & Runner-up)
        * 🏆 Double Men (Winner & Runner-up)
        * 🏆 Double Women (Winner & Runner-up)

---

## 4. Technical & Design Requirements

### 4.1. Technology Stack
* **Frontend:** React + Vite + TypeScript.
* **Animations/Icons:** `animateicons` for dynamic UI interactions.
* **Backend & Database:** Supabase (utilizing its PostgreSQL database and out-of-the-box real-time subscriptions for the live scoreboard).

### 4.2. UI/UX & Design System
* **Mobile Responsiveness:** The application *must* be heavily optimized for mobile devices, as players and spectators will primarily access it via smartphones at the venue.
* **Color Palette:**
    * **Midnight Navy:** `#1820F` (Primary backgrounds, deep contrast elements)
    * **Slate Blue:** `#68748a` (Secondary elements, neutral borders)
    * **Mist Gray:** `#dc1e6` (Cards, elevated backgrounds)
    * **Warm White:** `#f4f7f2` (Main text, primary light backgrounds)
    * **Copper Accent:** `#b8734f` (Call-to-action buttons, active match highlights, Winner/Runner-up emphasis)

### 4.3. Database Schema Adjustments (Supabase/PostgreSQL)
* The `Matches` table must include fields for `next_match_winner_id` and `next_match_loser_id`. This allows the database to automatically "route" the winning team to their next Upper Bracket game and the losing team down into the correct slot in the Lower Bracket.
* Ensure Supabase Realtime is enabled on the `Match_Sets` table so the frontend React application can listen to `+1` / `-1` point updates instantly.
