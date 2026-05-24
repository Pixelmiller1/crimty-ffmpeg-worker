# Crimty FFmpeg Worker

This service:
- downloads uploaded videos from Supabase
- converts them to iPhone-compatible MP4 (H.264 + AAC)
- uploads processed videos back to Supabase
- updates database with processed URL

## Required ENV VARS

- TRANSCODE_WORKER_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_KEY

## FFmpeg command used

- H.264 video
- AAC audio
- yuv420p pixel format
- faststart enabled
