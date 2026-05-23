/**
 * Configuration Remotion pour les vidéos ApeX.
 * - 1080×1920 (vertical 9:16) pour TikTok, WhatsApp Status, Reels, Shorts
 * - 30 fps : standard mobile, fluide
 * - h264 + AAC : compatibilité maximale
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setEntryPoint('./src/index.ts');
