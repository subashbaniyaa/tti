import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*"
}));

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/imagine', (req, res) => {
  res.sendFile(path.join(__dirname, 'imagine.html'));
});
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});
app.get('/404', (req, res) => {
  res.sendFile(path.join(__dirname, '404.html'));
});

const notAllowed = ["subash", "baniya"];

async function generateImage(prompt, aspect_ratio = '1x1') {
  const baseURL = 'https://api.creartai.com/api/v1/text2image';

  const options = {
    method: 'POST',
    url: baseURL,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: new URLSearchParams({
      prompt,
      negative_prompt:
        ',malformed hands,malformed fingers,malformed faces,malformed body parts,mutated body parts,malformed eyes,mutated fingers,mutated hands,realistic,worst quality, low quality, blurry, pixelated, extra limb, extra fingers, bad hand, text, name, letters, out of frame, lowres, text, error, cropped, jpeg artifacts, ugly, duplicate, morbid, mutilated, out of frame, poorly drawn hands, poorly drawn face, mutation, deformed, dehydrated, bad anatomy, bad proportions, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, fused fingers, too many fingers, long neck, username,',
      aspect_ratio,
      controlnet_conditioning_scale: 0.5,
      guidance_scale: '5.5',
    }),
  };

  const response = await axios(options);
  return response.data.image_base64;
}

app.get('/api/imagine', async (req, res) => {
  const { prompt } = req.query;

  if (!prompt || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Please provide a valid prompt." });
  }

  const bannedWord = notAllowed.find(word =>
    new RegExp(`\\b${word}\\b`, "i").test(prompt)
  );

  if (bannedWord) {
    return res.status(400).json({
      error: `Sorry, but you are not allowed to use the word "${bannedWord}".`,
    });
  }

  try {
    // Generate 2 square images (1:1) and 1 widescreen (16:9)
    const [img1, img2, img3] = await Promise.all([
      generateImage(prompt, '1x1'),
      generateImage(prompt, '1x1'),
      generateImage(prompt, '16x9'),
    ]);

    res.json({
      images: [
        `data:image/jpeg;base64,${img1}`,
        `data:image/jpeg;base64,${img2}`,
        `data:image/jpeg;base64,${img3}`,
      ],
    });
  } catch (error) {
    console.error('Image generation error:', error.message);
    res.status(500).json({
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Failed to generate images. Please try again later.",
    });
  }
});

app.get("/api/chat", async (req, res) => {
  const prompt = req.query.prompt;

  if (!prompt) {
    return res.status(400).json({
      error: "The 'prompt' query parameter is required."
    });
  }

  try {
    const response = await axios.post(
      "https://api.deepinfra.com/v1/openai/chat/completions",
      {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        messages: [
          {
            role: "system",
            content: `You are a friendly AI Assistant, providing short, human-like, and engaging responses.`
          },
          { role: "user", content: prompt }
        ],
        stream: false
      },
      {
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "x-deepinfra-source": "web-embed",
          "Referer": "https://deepinfra.com/"
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: process.env.NODE_ENV === "development"
        ? error.message
        : "Chat request failed"
    });
  }
});

app.use((req, res, next) => {
  const blocked = [
    '/index.js',
    '/public/quotes.json',
    '/.env',
    '/package.json',
    '/package-lock.json',
    '/node_modules',
  ];

  if (blocked.some(f => req.url.startsWith(f))) {
    return res.status(404).sendFile(
      path.join(__dirname, '404.html'),
      (err) => {
        if (err) res.status(404).send("404 - Not Found");
      }
    );
  }

  next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);