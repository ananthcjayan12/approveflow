/**
 * The sample creatives used by the landing-page tours. They are plain HTML sized
 * in container units, so the same component works as a thumbnail or a full stage.
 */

/** A festive sale post. Version 2 is what the designer sends back after the client asked for a bigger offer and button. */
export function PostArt({ v = 1 }: { v?: 1 | 2 }) {
  return (
    <div className={`tv-art tv-post v${v}`}>
      <i className="orb" />
      <i className="orb o2" />
      <b className="head">
        Diwali
        <br />
        Sale
      </b>
      {v === 2 ? (
        <>
          <span className="offer">Up to 40% off</span>
          <span className="when">This weekend only</span>
        </>
      ) : (
        <span className="offer">Up to 40% off · This weekend only</span>
      )}
      <em className="shop">SHOP NOW</em>
    </div>
  );
}

/** A three-tile carousel slide. */
export function CarouselArt() {
  return (
    <div className="tv-art tv-carousel">
      <b className="head">New arrivals</b>
      <div className="tiles">
        <i />
        <i />
        <i />
      </div>
      <span className="dots">
        <u />
        <u />
        <u />
      </span>
    </div>
  );
}

/** A reel frame with a play button. */
export function ReelArt() {
  return (
    <div className="tv-art tv-reel">
      <i className="sun" />
      <i className="hill h1" />
      <i className="hill h2" />
      <b className="head">Festive reel</b>
      <span className="play">
        <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}

export const ARTS = [PostArt, CarouselArt, ReelArt];
