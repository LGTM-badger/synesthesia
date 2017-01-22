import * as func from "../data/functional";
import {PlayStateData, PlayState} from "../data/play-state";

export interface PlayerProps {
  playState: PlayState;
  playStateUpdated: (value: PlayState) => void;
}

export class Player extends React.Component<PlayerProps, {}> {

  constructor() {
    super();

    // Bind callbacks & event listeners
    this.loadAudioFile = this.loadAudioFile.bind(this);
    this.updatePlayState = this.updatePlayState.bind(this);
  }

  render() {
    return (
      <externals.ShadowDOM>
        <div>
          <link rel="stylesheet" type="text/css" href="dist/styles/components/player.css"/>
          <input id="file_picker" type="file" onChange={this.loadAudioFile} />
          <audio id="audio" controls
            onCanPlay={this.updatePlayState}
            />
        </div>
      </externals.ShadowDOM>
    );
  }

  private $() {
    return $((ReactDOM.findDOMNode(this) as any).shadowRoot);
  }

  private fileInputElement() {
    return this.$().find('input').get(0) as HTMLInputElement;
  }

  private audioElement() {
    return this.$().find('audio').get(0) as HTMLAudioElement;
  }

  private loadAudioFile() {
    console.log("loadAudioFile", this.fileInputElement(), this.audioElement());

    const file = this.fileInputElement().files[0];
    console.debug('file', file);
    const audio = this.audioElement();
    audio.src = URL.createObjectURL(file);
    audio.playbackRate = 1;
  }

  /**
   * Update the play state from the audio element, and send it up.
   */
  private updatePlayState() {
    const state: PlayStateData = {
      duration: this.audioElement().duration
    };
    console.log('play state', state);
    this.props.playStateUpdated(func.just(state));
  }
}