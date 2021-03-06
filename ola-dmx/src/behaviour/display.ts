import {PlayStateData} from '../shared/protocol/messages';
import {CueFile} from '../shared/file/file';
import {
    prepareFile,
    getActiveEvents,
    getCurrentEventStateValue
  } from '../shared/file/file-usage';

import {DmxProxy} from '../dmx/proxy';
import * as config from '../config';
import * as util from '../util';
import {RGBColor, RGB_BLACK, randomRGBColorPallete} from './colors';

const INTERVAL = 1000 / 44;
const CHANGE_INTERVAL = 60 * 1000;

interface LayerState {
  brightness: number;
}

interface RGBChasePattern {
  patternType: 'rgbChase';
  colors: RGBColor[];
  /** How many frames should we wait before transitioning */
  waitTime: number;
  /** How many frames should it take to transition */
  transitionTime: number;
  currentColor: number;
  /** Number of frames we've been on the current color for */
  currentColorTime: number;
  /** Which synesthesia layers are affecting the display of this pattern */
  targetLayers: number[];
}

type FixtureColorPattern = RGBChasePattern;

interface FixtureMovementPattern {
  stage: number;
  /** Number of frames the stage has been active for */
  stageTime: number;
}

interface FixtureLayout {
  color: FixtureColorPattern;
  nextColor?: {
    color: FixtureColorPattern;
    frame: number;
    transitionTime: number;
  };
  movement?: FixtureMovementPattern;
}

/*
 * Describes what we're currently displaying on the fixures, and how we're
 * taking into account the synesthesia data to modify the display
 */
interface Layout {
  fixtures: FixtureLayout[];
}

function randomRGBChaseState(colors: RGBColor[], targetLayers: number[], waitTime: number, transitionTime: number): RGBChasePattern {
  return {
    patternType: 'rgbChase',
    colors,
    waitTime,
    transitionTime,
    currentColor: Math.floor(Math.random() * colors.length),
    currentColorTime: util.randomInt(0, 40 + 20),
    targetLayers
  };
}

export class Display {

  private readonly config: config.Config;
  private readonly dmx: DmxProxy;
  // Mapping form universe to buffers
  private readonly buffers: {[id: number]: Int8Array} = {};
  private layout: Layout;
  private playState: PlayStateData | null;

  public constructor(config: config.Config, dmx: DmxProxy) {
    this.config = config;
    this.dmx = dmx;
    this.newSynesthesiaPlayState = this.newSynesthesiaPlayState.bind(this);
    // create one buffer for each universe we have
    for (const fixture of config.fixtures) {
      if (!this.buffers[fixture.universe])
        this.buffers[fixture.universe] = new Int8Array(512);
    }
    // create the layout, do a random chaser for now for every fixture
    const colorPallete = randomRGBColorPallete();
    const fixtures: FixtureLayout[] = config.fixtures.map(config => ({
      color: randomRGBChaseState(colorPallete, [-1], 0, 40)
    }));

    this.layout = {fixtures};

    setInterval(this.randomizeColours.bind(this), CHANGE_INTERVAL);
  }

  public newSynesthesiaPlayState(state: PlayStateData | null): void {
    this.playState = state ? {
      effectiveStartTimeMillis: state.effectiveStartTimeMillis,
      file: prepareFile(state.file)
    } : null;
    if (this.playState) {
      // Mapping from groups to list of synesthesia layers it's targeting
      const groupsToLayers: {[id: string]: number[]} = {};
      for (const fixture of this.config.fixtures)
        groupsToLayers[fixture.group] = [];

      // Assign a group to each layer
      for (let i = 0; i < this.playState.file.layers.length; i++) {
        // find the group with the least number of layers
        let currentMinGroup: {group: string, layersCount: number} | null = null;
        for (const group of Object.keys(groupsToLayers)) {
          const layersCount = groupsToLayers[group].length;
          if (currentMinGroup === null || currentMinGroup.layersCount > layersCount)
            currentMinGroup = {group, layersCount};
        }
        if (currentMinGroup)
          groupsToLayers[currentMinGroup.group].push(i);
      }
      // For every group, if it has no layers, randomly pick one
      for (const group of Object.keys(groupsToLayers)) {
        if (groupsToLayers[group].length === 0)
          groupsToLayers[group].push(Math.floor(Math.random() * this.playState.file.layers.length));
      }
      // create the layout, do a random chaser for now for every fixture
      const colorPallete = randomRGBColorPallete();
      const fixtures: FixtureLayout[] = this.config.fixtures.map(config => ({
        color: randomRGBChaseState(colorPallete, groupsToLayers[config.group], 0, 40)
      }));

      this.layout = {fixtures};
    }
    console.log('newSynesthesiaPlayState', this.playState );
  }

  private randomizeColours() {
    const colorPallete = randomRGBColorPallete();
    const wait = util.randomInt(0, 40);
    const transition = util.randomInt(20, 40);
    for (const fixture of this.layout.fixtures) {
      const color = randomRGBChaseState(colorPallete, fixture.color.targetLayers, wait, transition);
      fixture.nextColor = {color, frame: 0, transitionTime: 60};
    }
  }

  private calculateAndIncrementPatternColor(layerStates: LayerState[], fixture: config.Fixture, pattern: FixtureColorPattern): RGBColor {
    if (pattern.patternType === 'rgbChase') {
      const colorPattern = pattern;
      let currentColor = this.calculateRGBChasePatternColor(colorPattern);
      let brightness = 0.7;
      if (layerStates.length > 0 && colorPattern.targetLayers.length > 0) {
        brightness = Math.max.apply(null, colorPattern.targetLayers.map(layer =>
          layerStates[layer].brightness
        ));
        if (fixture.group === 'hex-small') {
          brightness = brightness * 0.7 + 0.15;
        }
      }
      currentColor = currentColor.overlay(RGB_BLACK, 1 - brightness);
      this.incrementRGBChasePatternColor(colorPattern);
      return currentColor;
    }
    throw new Error('not implemnted');
  }

  private frame() {

    let layerStates: LayerState[] = [];

    if (this.playState) {
      const positionMillis = new Date().getTime() - this.playState.effectiveStartTimeMillis;

      for (const layer of this.playState.file.layers) {
        const state: LayerState = {
          brightness: 0
        };
        layerStates.push(state);
        if (layer.kind === 'percussion') {
          const activeEvents = getActiveEvents(layer.events, positionMillis);
          if (activeEvents.length > 0) {
            for (const event of activeEvents) {
              const amplitude = getCurrentEventStateValue(event, positionMillis, s => s.amplitude);
              state.brightness = Math.max(state.brightness, amplitude);
            }
          }
        }
      }
    }

    for (let i = 0; i < this.config.fixtures.length; i++) {
      const fixture = this.config.fixtures[i];
      const layout = this.layout.fixtures[i];

      // Update colour
      let color = this.calculateAndIncrementPatternColor(layerStates, fixture, layout.color);
      if (layout.nextColor) {
        const nextColor = this.calculateAndIncrementPatternColor(layerStates, fixture, layout.nextColor.color);
        console.log('overlay', layout.nextColor.frame / layout.nextColor.transitionTime);
        color = color.overlay(nextColor, layout.nextColor.frame / layout.nextColor.transitionTime);
        layout.nextColor.frame++;
        if (layout.nextColor.frame >= layout.nextColor.transitionTime) {
          layout.color = layout.nextColor.color;
          layout.nextColor = undefined;
        }
      }
      if (fixture.brightness !== undefined)
        color = color.overlay(RGB_BLACK, 1 - fixture.brightness);
      this.setFixtureRGBColor(fixture, color);

      // Update static static channels
      for (let i = 0; i < fixture.channels.length; i++) {
        const channel = fixture.channels[i];
        if (channel.kind === 'static') {
          this.setDMXBufferValue(fixture.universe, fixture.startChannel + i, channel.value);
        }
      }

      // Update movement
      if (fixture.movement && fixture.movement.stages.length > 0) {
        if (!layout.movement) {
          layout.movement = {
            stage: 0, stageTime: 0
          };
        }

        const stage = fixture.movement.stages[layout.movement.stage];

        // Set channel values
        let stageChannelIndex = 0;
        for (let i = 0; i < fixture.channels.length; i++) {
          const channel = fixture.channels[i];
          if (channel.kind === 'movement' && stageChannelIndex < stage.channelValues.length) {
            const val = stage.channelValues[stageChannelIndex];
            stageChannelIndex++;
            this.setDMXBufferValue(fixture.universe, fixture.startChannel + i, val);
          } else if (channel.kind === 'speed') {
            this.setDMXBufferValue(fixture.universe, fixture.startChannel + i, stage.speed);
          }
        }

        // Increment Stage
        layout.movement.stageTime++;
        if (layout.movement.stageTime > fixture.movement.stageInterval) {
          layout.movement.stage++;
          layout.movement.stageTime = 0;
          if (layout.movement.stage >= fixture.movement.stages.length) {
            layout.movement.stage = 0;
          }
        }
      }
    }

    // Write Universes
    for (const universe of Object.keys(this.buffers)) {
      this.dmx.writeDmx(Number(universe), this.buffers[universe]);
    }
  }

  private incrementRGBChasePatternColor(pattern: RGBChasePattern) {
    pattern.currentColorTime ++;
    if (pattern.currentColorTime >= pattern.waitTime + pattern.transitionTime) {
      pattern.currentColorTime = 0;
      pattern.currentColor++;
      if (pattern.currentColor >= pattern.colors.length) {
        pattern.currentColor = 0;
      }
    }
  }

  private calculateRGBChasePatternColor(pattern: RGBChasePattern) {
    if (pattern.currentColorTime < pattern.waitTime)
      return pattern.colors[pattern.currentColor];
    const colorA = pattern.colors[pattern.currentColor];
    const colorBIndex = pattern.currentColor === pattern.colors.length - 1 ?
      0 : pattern.currentColor + 1;
    const colorB = pattern.colors[colorBIndex];
    return colorA.transition(colorB, (pattern.currentColorTime - pattern.waitTime) / pattern.transitionTime);
  }

  private setFixtureRGBColor(fixture: config.Fixture, color: RGBColor) {
    let rChannel = -1, gChannel = -1, bChannel = -1;
    for (let i = 0; i < fixture.channels.length; i++) {
      const channel = fixture.channels[i];
      if (channel.kind === 'color') {
        if (channel.color === 'r') {
          rChannel = fixture.startChannel + i;
        } else if (channel.color === 'g') {
          gChannel = fixture.startChannel + i;
        } else if (channel.color === 'b') {
          bChannel = fixture.startChannel + i;
        }
      }
    }
    if (rChannel >= 0 && gChannel >= 0 && bChannel >= 0) {
      this.setDMXBufferValue(fixture.universe, rChannel, color.r);
      this.setDMXBufferValue(fixture.universe, gChannel, color.g);
      this.setDMXBufferValue(fixture.universe, bChannel, color.b);
    }
  }

  private setDMXBufferValue(universe: number, channel: number, value: number) {
    this.buffers[universe][channel - 1] = value;
  }

  public run() {
    setInterval(this.frame.bind(this), INTERVAL);
  }
}
