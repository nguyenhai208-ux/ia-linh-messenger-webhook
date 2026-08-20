# Messenger webhook – Gia Linh FNG

This service is the secure, read-only first step for the Messenger AI project.

## What it does

- Answers Meta's `GET /webhook` verification challenge.
- Validates every Meta `POST /webhook` payload using `X-Hub-Signature-256`.
- Acknowledges valid events without storing message contents or sending replies.

## What it deliberately does not do yet

- It does not save parent or child message data.
- It does not call an AI model.
- It does not send messages to Messenger.

## Run locally

1. Use Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set a long random `VERIFY_TOKEN` and the Meta app's `APP_SECRET`.
3. Run `npm start`.

Meta requires the callback URL to be a public HTTPS endpoint. Before setting up the webhook in Meta, deploy this service to an approved company hosting environment and use:

`https://<company-host>/webhook`

as **URL gọi lại**, and use the same `VERIFY_TOKEN` value as **Xác minh mã**.

## Next safe milestone

After Meta verifies the endpoint, add an approved, access-controlled data store and a review screen for sales. Only then enable message analysis; outbound sending remains off by default.
