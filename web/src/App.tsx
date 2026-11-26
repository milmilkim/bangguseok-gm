import {homeSlug, slug} from './api';
import {Game} from './Game';
import {Home} from './Home';
import {Lobby} from './Lobby';

export function App() {
  return <main className="rp-page">{slug ? <Game c={slug} /> : homeSlug ? <Home c={homeSlug} /> : <Lobby />}</main>;
}
