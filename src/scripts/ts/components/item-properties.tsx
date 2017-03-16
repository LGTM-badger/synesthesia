import {BaseComponent} from "./base";
import * as React from "react";
import * as file from "../data/file";
import * as selection from "../data/selection";
import * as func from "../data/functional";
import * as text from "../display/text";
import * as fileManipulation from "../data/file-manipulation";
import * as types from "../util/types";

interface EventPropertiesProps {
  // Properties
  selection: selection.Selection;
  file: file.CueFile;
  // Callbacks
  updateCueFile: types.Mutator<file.CueFile>;
}

export class EventProperties extends BaseComponent<EventPropertiesProps, {}> {

  public constructor() {
    super();

    // Bind callbacks & event listeners
    this.onStartTimeChange = this.onStartTimeChange.bind(this);
  }

  private getEvent(e: {layer: number, index: number}) {
    return this.props.file.layers[e.layer].events[e.index];
  }

  private getEarliestStartTime() {
    const startTimes = this.props.selection.events.map(e => this.getEvent(e).timestampMillis);
    return Math.round(Math.min.apply(null, startTimes));
  }

  private onStartTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    this.props.updateCueFile(f => fileManipulation.updateStartTimeForSelection(f, this.props.selection, val));
  }

  render() {
    const selectedEvents = this.props.selection.events.length;
    return (
      <externals.ShadowDOM>
        <div>
          <link rel="stylesheet" type="text/css" href="styles/components/item-properties.css"/>
          {selectedEvents > 0 ?
            <div className="selection">{text.pluralize(selectedEvents, 'Item', 'Items')} Selected</div> :
            <div className="selection empty">Nothing Selected</div>
          }
          {selectedEvents > 0 ?
            <div className="properties">
              <div className="property">
                <label id="startTime" title="Start time in milliseconts">Start Time</label>
                <input htmlFor="startTime" type="number" value={this.getEarliestStartTime()} onChange={this.onStartTimeChange} />
              </div>
            </div>
            : null
          }
        </div>
      </externals.ShadowDOM>
    );
  }
}
