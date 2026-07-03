import { Composition } from 'remotion';
import { CoinChange } from './CoinChange';
import { DURATION_IN_FRAMES, FPS, WIDTH, HEIGHT } from './config';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CoinChange"
      component={CoinChange}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
