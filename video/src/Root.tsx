import { Composition } from "remotion";
import { Promo } from "./Promo";

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={1800} fps={60} width={1920} height={1080} />
);
