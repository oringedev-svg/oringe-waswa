// Meeting provider abstraction.
//
// Scheduling never talks to Google or Microsoft directly. It picks a provider
// by key and asks it for a meeting; the provider decides whether that means
// minting a conferencing link or simply recording a room number. Adding Zoom
// or Webex later means adding one object to PROVIDERS, with no change to the
// scheduling flow, the routes, or the UI beyond a new option in the picker.

import {
  createGoogleEvent,
  type CalendarConnection,
  type RefreshedTokens,
} from './googleCalendar'
import { createMicrosoftEvent } from './microsoftGraph'

export type MeetingProviderKey = 'physical' | 'google_meet' | 'teams' | 'other'

export interface VenueDetails {
  venue_name?: string | null
  building?: string | null
  room?: string | null
  address?: string | null
  location_notes?: string | null
}

export interface MeetingRequest {
  title: string
  description?: string | null
  location?: string | null
  startAt: string
  endAt: string
  attendeeEmails: string[]
  /**
   * The organiser's connection for whichever provider this is. A conferencing
   * link is hosted by a person, not by the firm, so without it there is
   * nobody to host the meeting.
   */
  organizerConnection?: CalendarConnection | null
  /** Only meaningful for the 'other' provider: a link typed by a human. */
  manualLink?: string | null
}

export interface MeetingResult {
  meetingLink: string | null
  meetingExternalId: string | null
  /**
   * Google Meet and Teams links are minted *by* creating a calendar event on
   * the organiser's calendar, so that event already exists by the time the
   * sync layer runs. Reporting it here stops the organiser getting a
   * duplicate copy of their own meeting.
   */
  organizerSync?: { connectionId: string; externalEventId: string } | null
  refreshed?: RefreshedTokens | null
  /** Why no link was produced. Never fatal: the meeting still gets scheduled. */
  warning?: string | null
}

export interface MeetingProvider {
  key: MeetingProviderKey
  label: string
  /** Which external calendar grant the organiser needs, if any. */
  requiresConnection: 'google' | 'microsoft' | null
  createMeeting(req: MeetingRequest): Promise<MeetingResult>
}

// ---------------------------------------------------------------------------
// Physical
// ---------------------------------------------------------------------------

const physical: MeetingProvider = {
  key: 'physical',
  label: 'Physical meeting',
  requiresConnection: null,
  async createMeeting() {
    return { meetingLink: null, meetingExternalId: null }
  },
}

// ---------------------------------------------------------------------------
// Google Meet
// ---------------------------------------------------------------------------

const googleMeet: MeetingProvider = {
  key: 'google_meet',
  label: 'Google Meet',
  requiresConnection: 'google',
  async createMeeting(req) {
    if (!req.organizerConnection) {
      return {
        meetingLink: null,
        meetingExternalId: null,
        warning:
          'No Google Meet link was created: the organiser has not connected a Google Calendar. The meeting is scheduled and everyone has been notified.',
      }
    }

    const { externalEventId, meetLink, refreshed } = await createGoogleEvent(req.organizerConnection, {
      title: req.title,
      description: req.description,
      location: req.location,
      startAt: req.startAt,
      endAt: req.endAt,
      attendeeEmails: req.attendeeEmails,
      withMeet: true,
    })

    return {
      meetingLink: meetLink,
      meetingExternalId: externalEventId,
      organizerSync: { connectionId: req.organizerConnection.id, externalEventId },
      refreshed,
    }
  },
}

// ---------------------------------------------------------------------------
// Microsoft Teams
// ---------------------------------------------------------------------------

const teams: MeetingProvider = {
  key: 'teams',
  label: 'Microsoft Teams',
  requiresConnection: 'microsoft',
  async createMeeting(req) {
    if (!req.organizerConnection) {
      return {
        meetingLink: null,
        meetingExternalId: null,
        warning:
          'No Teams link was created: the organiser has not connected an Outlook calendar. The meeting is scheduled and everyone has been notified.',
      }
    }

    const { externalEventId, joinUrl, refreshed } = await createMicrosoftEvent(
      req.organizerConnection,
      {
        title: req.title,
        description: req.description,
        location: req.location,
        startAt: req.startAt,
        endAt: req.endAt,
        attendeeEmails: req.attendeeEmails,
      },
      true,
    )

    return {
      meetingLink: joinUrl,
      meetingExternalId: externalEventId,
      organizerSync: { connectionId: req.organizerConnection.id, externalEventId },
      refreshed,
    }
  },
}

// ---------------------------------------------------------------------------
// Other / manual
// ---------------------------------------------------------------------------

// The escape hatch for a conferencing service the firm uses but the app does
// not integrate with. Keeping it explicit means "we integrate with this" and
// "someone pasted a URL" stay distinguishable in the data.
const other: MeetingProvider = {
  key: 'other',
  label: 'Other (paste a link)',
  requiresConnection: null,
  async createMeeting(req) {
    return { meetingLink: req.manualLink || null, meetingExternalId: null }
  },
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PROVIDERS: Record<MeetingProviderKey, MeetingProvider> = {
  physical,
  google_meet: googleMeet,
  teams,
  other,
}

export function getMeetingProvider(key: string): MeetingProvider {
  return PROVIDERS[key as MeetingProviderKey] || physical
}

export function listMeetingProviders(): MeetingProvider[] {
  return Object.values(PROVIDERS)
}

// ---------------------------------------------------------------------------
// Venue formatting
// ---------------------------------------------------------------------------

/**
 * Collapses the structured venue fields into the single `location` line that
 * .ics invites, emails and every existing reader already expect. The
 * structured columns are what the UI edits; this is what everything else
 * consumes.
 */
export function buildLocationSummary(venue: VenueDetails): string | null {
  const parts = [venue.room, venue.building, venue.venue_name, venue.address]
    .map((p) => (p || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
