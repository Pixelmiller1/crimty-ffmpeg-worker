import express from "express";
import axios from "axios";
import fs from "fs";
import { exec } from "child_process";

const app = express();
app.use(express.json());

const SECRET = process.env.TRANSCODE_WORKER_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

app.post("/process", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!auth || auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, raw_url } = req.body;

    const inputPath = `/tmp/${id}-input.mp4`;
    const outputPath = `/tmp/${id}-output.mp4`;

    // download video
    const video = await axios.get(raw_url, { responseType: "stream" });
    const writer = fs.createWriteStream(inputPath);
    video.data.pipe(writer);

    await new Promise(resolve => writer.on("finish", resolve));

    // FFmpeg conversion (iPhone-safe)
    await new Promise((resolve, reject) => {
      exec(`
        ffmpeg -y -i ${inputPath} \
        -c:v libx264 \
        -pix_fmt yuv420p \
        -c:a aac \
        -b:a 128k \
        -ac 2 \
        -ar 44100 \
        -movflags +faststart \
        ${outputPath}
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // upload back to Supabase
    const file = fs.readFileSync(outputPath);

    await axios.post(
      `${SUPABASE_URL}/storage/v1/object/videos/processed-${id}.mp4`,
      file,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "video/mp4"
        }
      }
    );

    const processedUrl =
      `${SUPABASE_URL}/storage/v1/object/public/videos/processed-${id}.mp4`;

    // update DB
    await axios.patch(
      `${SUPABASE_URL}/rest/v1/video_uploads?id=eq.${id}`,
      {
        processed_url: processedUrl,
        status: "done"
      },
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ success: true, processedUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "processing failed" });
  }
});

app.listen(3000, () => {
  console.log("FFmpeg worker running");
});
