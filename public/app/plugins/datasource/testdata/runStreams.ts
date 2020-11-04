import { defaults } from 'lodash';
import { Observable } from 'rxjs';
import MQTT from 'async-mqtt';
import { getTemplateSrv } from '@grafana/runtime';

// import * as https from 'https';
// import { webSocket } from 'rxjs/webSocket';

import {
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  CircularDataFrame,
  CSVReader,
  Field,
  LoadingState,
} from '@grafana/data';

import { TestDataQuery, StreamingQuery } from './types';
import { getRandomLine } from './LogIpsum';

export const defaultQuery: StreamingQuery = {
  type: 'mqtt',
  type_field: 'speed',
  update: 250, // ms
  spread: 3.5,
  noise: 2.2,
  bands: 1,
};

var mappings: { [key: string]: any } = {
  speed: 'vehicle_status',
  rpm: 'vehicle_engine',
  engaged_manual: 'vehicle_gear',
  throttle: 'vehicle_pedal',
  brake_pressure: 'vehicle_pedal',
  latitude: 'vehicle_position',
  longitude: 'vehicle_position',
  torque: 'vehicle_engine',
};

export function runStream(target: TestDataQuery, req: DataQueryRequest<TestDataQuery>): Observable<DataQueryResponse> {
  const query = defaults(target.stream, defaultQuery);
  if ('signal' === query.type) {
    return runSignalStream(target, query, req);
  }
  if ('logs' === query.type) {
    return runLogsStream(target, query, req);
  }
  if ('fetch' === query.type) {
    return runFetchStream(target, query, req);
  }
  if ('mqtt' === query.type) {
    return runMQTTStream(target, query, req);
  }
  throw new Error(`Unknown Stream Type: ${query.type}`);
}

export function runMQTTStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    console.log('target ', target);
    const streamId = `signal-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    const data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Signal ' + target.refId;
    data.addField({ name: 'time', type: FieldType.time });
    data.addField({ name: 'value', type: FieldType.number });

    const { update, type_field } = query;
    console.log(type_field, update);

    let value = 0;
    // let time = Date.now();
    let timeoutId: any = null;

    const option = {
      username: 'admin',
      password: 'Spindox123!',
      clientId: 'grafanaPlugin',
      rejectedUnauthorized: false,
      ca: './ca-chain-server.crt',
    };
    const client = MQTT.connect('wss://pre-sdp.lamborghini.com:443/ws/mqtt', option);
    // const client = MQTT.connect('ws://localhost:8083/mqtt');

    client.on('error', error => {
      console.log('client NOT connected', error);
    });
    client.on('connect', () => {
      console.log('client connected');
    });

    const query_vin = getTemplateSrv().replace('$vin', req.scopedVars);
    console.log('vin: ', query_vin);
    client.subscribe('big_data/' + query_vin);
    client.on('message', async (topic, payload) => {
      const message = JSON.parse(payload.toString()) || {};
      console.log('mqttListener', `New message in ${topic}`, message);
      if (message.target === mappings[type_field]) {
        try {
          const { fields, time, source: vin } = message;
          console.log(time, vin);
          value = fields[type_field];
          console.log(type_field, value);
        } catch (err) {
          console.error('mqttListener', 'An error occured while service save dato into db', err);
        }
      }
    });

    const addNextRow = (time: number) => {
      // value += (Math.random() - 0.5) * spread;
      let idx = 0;
      data.fields[idx++].values.add(time);
      data.fields[idx++].values.add(value);
    };

    // Fill the buffer on init
    // console.log('time: ', time);
    // for (let i = 0; i < maxDataPoints; i++) {
    //   addNextRow(time);
    //   time += update;
    // }
    const pushNextEvent = () => {
      addNextRow(Date.now());
      subscriber.next({
        data: [data],
        key: streamId,
      });

      timeoutId = setTimeout(pushNextEvent, update);
    };

    // Send first event in 500ms
    setTimeout(pushNextEvent, 500);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}

export function runSignalStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `signal-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    const data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Signal ' + target.refId;
    data.addField({ name: 'time', type: FieldType.time });
    data.addField({ name: 'value', type: FieldType.number });

    const { spread, update, bands = 0, noise } = query;

    for (let i = 0; i < bands; i++) {
      const suffix = bands > 1 ? ` ${i + 1}` : '';
      data.addField({ name: 'Min' + suffix, type: FieldType.number });
      data.addField({ name: 'Max' + suffix, type: FieldType.number });
    }

    let value = Math.random() * 100;
    let timeoutId: any = null;

    const addNextRow = (time: number) => {
      value += (Math.random() - 0.5) * spread;

      let idx = 0;
      data.fields[idx++].values.add(time);
      data.fields[idx++].values.add(value);

      let min = value;
      let max = value;

      for (let i = 0; i < bands; i++) {
        min = min - Math.random() * noise;
        max = max + Math.random() * noise;

        data.fields[idx++].values.add(min);
        data.fields[idx++].values.add(max);
      }
    };

    // Fill the buffer on init
    if (true) {
      let time = Date.now() - maxDataPoints * update;
      for (let i = 0; i < maxDataPoints; i++) {
        addNextRow(time);
        time += update;
      }
    }

    const pushNextEvent = () => {
      addNextRow(Date.now());
      subscriber.next({
        data: [data],
        key: streamId,
      });

      timeoutId = setTimeout(pushNextEvent, update);
    };

    // Send first event in 5ms
    setTimeout(pushNextEvent, 5);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}

export function runLogsStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `logs-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    const data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Logs ' + target.refId;
    data.addField({ name: 'line', type: FieldType.string });
    data.addField({ name: 'time', type: FieldType.time });
    data.meta = { preferredVisualisationType: 'logs' };

    const { update } = query;

    let timeoutId: any = null;

    const pushNextEvent = () => {
      data.values.time.add(Date.now());
      data.values.line.add(getRandomLine());

      subscriber.next({
        data: [data],
        key: streamId,
      });

      timeoutId = setTimeout(pushNextEvent, update);
    };

    // Send first event in 5ms
    setTimeout(pushNextEvent, 5);

    return () => {
      console.log('unsubscribing to stream ' + streamId);
      clearTimeout(timeoutId);
    };
  });
}

export function runFetchStream(
  target: TestDataQuery,
  query: StreamingQuery,
  req: DataQueryRequest<TestDataQuery>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>(subscriber => {
    const streamId = `fetch-${req.panelId}-${target.refId}`;
    const maxDataPoints = req.maxDataPoints || 1000;

    let data = new CircularDataFrame({
      append: 'tail',
      capacity: maxDataPoints,
    });
    data.refId = target.refId;
    data.name = target.alias || 'Fetch ' + target.refId;

    let reader: ReadableStreamReader<Uint8Array>;
    const csv = new CSVReader({
      callback: {
        onHeader: (fields: Field[]) => {
          // Clear any existing fields
          if (data.fields.length) {
            data = new CircularDataFrame({
              append: 'tail',
              capacity: maxDataPoints,
            });
            data.refId = target.refId;
            data.name = 'Fetch ' + target.refId;
          }
          for (const field of fields) {
            data.addField(field);
          }
        },
        onRow: (row: any[]) => {
          data.add(row);
        },
      },
    });

    const processChunk = (value: ReadableStreamReadResult<Uint8Array>): any => {
      if (value.value) {
        const text = new TextDecoder().decode(value.value);
        csv.readCSV(text);
      }

      subscriber.next({
        data: [data],
        key: streamId,
        state: value.done ? LoadingState.Done : LoadingState.Streaming,
      });

      if (value.done) {
        console.log('Finished stream');
        subscriber.complete(); // necessary?
        return;
      }

      return reader.read().then(processChunk);
    };

    if (!query.url) {
      throw new Error('query.url is not defined');
    }

    fetch(new Request(query.url)).then(response => {
      if (response.body) {
        reader = response.body.getReader();
        reader.read().then(processChunk);
      }
    });

    return () => {
      // Cancel fetch?
      console.log('unsubscribing to stream ' + streamId);
    };
  });
}
