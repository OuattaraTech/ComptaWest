import { Composition } from 'remotion';
import { Video90s } from './Video90s';
import { Video30s } from './Video30s';
import { Video15s } from './Video15s';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Video90s"
        component={Video90s}
        durationInFrames={90 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Video30s"
        component={Video30s}
        durationInFrames={30 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Video15s"
        component={Video15s}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
