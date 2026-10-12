import posthog from 'posthog-js'

// Event names follow the tracking plan in docs/04-تحليلات-سلوك-المستخدم.md
export type EventName =
  | 'app_opened'
  | 'signup_started'
  | 'otp_sent'
  | 'phone_verified'
  | 'logged_in'
  | 'logged_out'
  | 'listings_viewed'
  | 'filter_used'
  | 'search_performed'
  | 'listing_opened'
  | 'listing_images_swiped'
  | 'contact_call_clicked'
  | 'contact_whatsapp_clicked'
  | 'listing_create_clicked'
  | 'listing_draft_saved'
  | 'listing_description_entered'
  | 'listing_price_entered'
  | 'listing_image_uploaded'
  | 'listing_image_upload_failed'
  | 'listing_publish_failed'
  | 'listing_published'
  | 'listing_marked_sold'
  | 'listing_hidden'
  | 'listing_draft_abandoned'
  | 'profile_updated'
  // phase 2
  | 'review_started'
  | 'review_blocked_short'
  | 'review_posted'
  | 'review_reply_posted'
  | 'negotiation_opened_form'
  | 'negotiation_started'
  | 'negotiation_start_failed'
  | 'negotiation_replied'
  | 'negotiation_ended'
  | 'conversation_opened'
  | 'message_sent'
  | 'user_blocked'
  | 'user_unblocked'
  | 'notifications_opened'
  | 'notification_clicked'
  // phase 3
  | 'csat_shown'
  | 'csat_answered'
  | 'csat_skipped'
  | 'post_contact_survey_shown'
  | 'post_contact_survey_answered_first'
  | 'post_contact_survey_step'
  | 'post_contact_survey_exited'
  | 'post_contact_survey_completed'
  | 'seller_survey_answered'
  | 'seller_survey_skipped'

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com'
let ready = false

export function initAnalytics() {
  if (key && !ready) {
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      autocapture: false,
    })
    ready = true
  }
  track('app_opened', {
    source: document.referrer ? new URL(document.referrer).hostname : 'direct',
    device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  })
}

export function track(event: EventName, props?: Record<string, unknown>) {
  if (ready) {
    posthog.capture(event, props)
  } else if (import.meta.env.DEV) {
    console.debug('[event]', event, props ?? {})
  }
}

export function pageView(page: string, props?: Record<string, unknown>) {
  if (ready) posthog.capture('$pageview', { page, ...props })
}

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  if (ready) posthog.identify(userId, props)
}

export function resetAnalytics() {
  if (ready) posthog.reset()
}
