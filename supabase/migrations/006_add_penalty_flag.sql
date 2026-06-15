-- Migration 006: Add penalty shootout flag to matches
-- Knockout matches decided on penalties get won_on_penalties = true

ALTER TABLE public.matches ADD COLUMN won_on_penalties boolean DEFAULT false;
