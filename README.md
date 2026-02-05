# LighterMeet

Simple, open-source video conferencing built with [LiveKit](https://livekit.io) and Next.js.

## Features

- 🎥 High-quality video conferencing
- 🔒 End-to-end encryption support
- 🌐 Real-time translation (powered by OpenAI Whisper + GPT)
- 📱 Mobile-friendly responsive design
- 🚀 Deployed on Vercel

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [@livekit/components-react](https://github.com/livekit/components-js/) - LiveKit UI components
- [LiveKit Cloud](https://cloud.livekit.io/) - WebRTC infrastructure
- [OpenAI API](https://openai.com) - Real-time translation

## Demo

Visit [https://lightermeet.vercel.app](https://lightermeet.vercel.app)

## Dev Setup

Steps to get a local dev setup up and running:

1. Run `pnpm install` to install all dependencies.
2. Copy `.env.example` in the project root and rename it to `.env.local`.
3. Update the missing environment variables in the newly created `.env.local` file.
4. Run `pnpm dev` to start the development server and visit [http://localhost:3000](http://localhost:3000).
5. Start development 🎉

## Environment Variables

Required environment variables (see `.env.example`):

- `LIVEKIT_API_KEY` - Your LiveKit API key
- `LIVEKIT_API_SECRET` - Your LiveKit API secret
- `LIVEKIT_URL` - Your LiveKit server URL
- `OPENAI_API_KEY` - OpenAI API key for translation features

## License

Based on [LiveKit Meet](https://github.com/livekit/meet) - Apache 2.0 License
