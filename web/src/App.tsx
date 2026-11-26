import {slug} from './api';
import {Game} from './Game';
import {Lobby} from './Lobby';

export function App() {
  return <main className="rp-page">{slug ? <Game c={slug} /> : <Lobby />}</main>;
}
