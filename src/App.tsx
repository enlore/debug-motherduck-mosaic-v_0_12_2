import * as vg from "@uwdata/vgplot"
import { decodeIPC } from "@uwdata/mosaic-core"
import { Table } from "@uwdata/flechette"
// import * as arrow from 'apache-arrow';
import { getAsyncDuckDb, QueryResult } from '@motherduck/wasm-client';
import { AsyncDuckDBConnection, AsyncResultStreamIterator, AsyncDuckDB } from '@duckdb/duckdb-wasm'
import { useCallback, useEffect, useState } from 'react';
import './App.css'

// Flip this flag to switch between using a local DuckDB Wasm instance in the 
//   browser and connecting to MotherDuck:
const CONNECT_TO_MOTHERDUCK = true

// A Read-Scaling (e.g. read only) MotherDuck token:
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im4uZS5sb3JlbnNvbkBnbWFpbC5jb20iLCJzZXNzaW9uIjoibi5lLmxvcmVuc29uLmdtYWlsLmNvbSIsInBhdCI6Ink3M2hRS2ZsSWhscDE2aEVhV2EzaGo0aGgxeGZ4cTd1aVBwVVNFS0xmZXMiLCJ1c2VySWQiOiIzN2I1MTlmZC00OTA1LTRlMmMtODU2Yy1lMDgxZjZiNTJjNjciLCJpc3MiOiJtZF9wYXQiLCJyZWFkT25seSI6dHJ1ZSwidG9rZW5UeXBlIjoicmVhZF9zY2FsaW5nIiwiaWF0IjoxNzM4MzUwNDcxfQ.pgbFhh4oYx-hKPlzykVS0v_WGETdetGEOlvYsZToxLE'

function LinePlot({ connectToMotherDuck }: { connectToMotherDuck: boolean }) {
    const [plot, setPlot] = useState<unknown | null>(null)

    useEffect(() => {
        async function buildPlot() {
            if (connectToMotherDuck) {
                // Confirming that we can SELECT successfully
                const results = await vg.coordinator().query('SELECT tip_amount, tpep_pickup_datetime FROM sample_data.nyc.taxi LIMIT 10') as Table
                console.info(results.toArray())
                
                // Confirming that we can DESCRIBE successfully
                const d1 = await vg.coordinator().query('DESCRIBE SELECT tpep_pickup_datetime AS column FROM sample_data.nyc.taxi AS source') as Table
                console.info('d1', d1.toArray())
                
                // ERROR 2: Uncomment line 45 and the error thrown by the plot changes to:
                //
                // hook.js:608 TypeError: data.toColumns is not a function
                //   at arrowToColumns (to-data-columns.js:35:35)
                //   at toDataColumns (to-data-columns.js:24:7)
                //   at ConnectedMark.queryResult (Mark.js:177:17)
                //   at Coordinator.js:207:24
                //
                // This seems correlated with the use of quotes in the DESCRIBE query.
                //
                // The query string used on line 45 was derived from field-info.js:71 by 
                //   stringifying the return value of `Query.describe` in the console
                //   while paused on a breakpoint:
                //
                // String(Query.describe(q))
                // > 'DESCRIBE SELECT "tpep_pickup_datetime" AS "column" FROM "sample_data"."nyc"."taxi" AS "source"'
                
                // const d2 = await vg.coordinator().query('DESCRIBE SELECT "tpep_pickup_datetime" AS "column" FROM "sample_data"."nyc"."taxi" AS "source"')
                // console.info('d2', String(d2))

                // ERROR 1: The plot attempts to run DESCRIBE queries against the source columns but throws the following:
                //
                // field-info.js:75 Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'column_type')
                //   at getFieldInfo (field-info.js:75:19)
                //   at async Promise.all (:5173/index 1)
                //   at async queryFieldInfo (field-info.js:50:13)
                //   at async Coordinator.initializeClient (Coordinator.js:251:24)
                const plot = vg.plot(
                    vg.line(
                        vg.from('sample_data.nyc.taxi'),
                        {
                            x: 'tpep_pickup_datetime',
                            y: 'tip_amount'
                        }
                    )
                )
                
                setPlot(plot)

            } else {
                // Using a browser local DuckDB Wasm instance to build a table and query it works fine
                const queries = [
                    `CREATE TABLE jobs_trend (job_count INTEGER, month_year DATE)`,
                    `INSERT INTO jobs_trend VALUES (1, '2024-01-01'::DATE), (2, '2024-2-01'::DATE), (5, '2024-3-01'::DATE)`
                ]
    
                await vg.coordinator().exec(queries)

                const plot = vg.plot(
                    vg.line(
                        vg.from('jobs_trend'),
                        {
                            x: 'month_year',
                            y: 'job_count'
                        }
                    )
                )

                setPlot(plot)
            }
        }

        buildPlot()
    }, [connectToMotherDuck])

    return (
        <div>
            <h3> Line Plot </h3>
            <div ref={(node: HTMLDivElement | null) => {
                if (node && plot) {
                    node.innerHTML = "";
                    node.appendChild(plot as Node);
                }
            }}>
            </div>
        </div>
    )
}

function decodeIPCToFlechette(result: Uint8Array): Table {
  const table = decodeIPC(result)
  return table
}

//@ts-expect-error unused
async function arrowTableFromResult(result: QueryResult) {
  if (result.type === 'streaming') {
    const batches = await result.arrowStream.readAll();
    const table = new arrow.Table(batches);
    return table;
  } else {
    throw Error('expected streaming result');
  }
}

/**
 * Iterates asyncronously over batches of binary data sent by upstream and collects them in an Uint8Array
 * @param iter AsyncResultStreamIterator
 * @returns Promise<Uint8Array>
 */
async function accumulateIPCBuffer(iter: AsyncResultStreamIterator): Promise<Uint8Array> {
  const batches = []

  for await (const batch of iter) {
    batches.push(batch)
  }

  const len = batches.reduce((acc, batch) => acc += batch.length, 0)

  const outputBuffer = new Uint8Array(len)

  let offset = 0

  for (const batch of batches) {
    outputBuffer.set(batch, offset)
    offset += batch.length
  }

  return outputBuffer
}

/**
 * Start a query and poll it to see when it finishes. Get the IPC data and build a Uint8Array from it.
 * @param conn AsyncDuckDBConnection
 * @param sql string A DuckDB SQL query string
 * @returns Promise<Uint8Array | undefined> The query results IPC data stream all buffered into one place
 */
async function getMDArrowIPC(conn: AsyncDuckDBConnection, sql: string): Promise<Uint8Array | undefined> {
  return await conn.useUnsafe(async (bindings: AsyncDuckDB, connId: number) => {
    try {
      let header = await bindings.startPendingQuery(connId, sql);
      
      while (header == null) {
          header = await bindings.pollPendingQuery(connId);
      }

      // see the duckdb-wasm AsyncResultStreamIterator: https://github.com/duckdb/duckdb-wasm/blob/41c03bef54cbc310ba2afa2e5f71f7a22b38364f/packages/duckdb-wasm/src/parallel/async_connection.ts#L111-L158 
      const iter = new AsyncResultStreamIterator(bindings, connId, header);
      
      const buffer = await accumulateIPCBuffer(iter);
     
      return buffer;

    } catch (error) {
        // TODO blearg
        console.error(error)
    }
  });
}

async function mdConnector(token: string): Promise<vg.Connector> {
  // We need connection ID to poll against later and the MDConnection does not provide a useUnsafe method
  // const connection = MDConnection.create({
  //   mdToken: token,
  // });

  // So we drop down a level to the DuckDB instance and get a connection from it
  const duckDb = await getAsyncDuckDb({
    mdToken: token,
  })

  const duckDbConn = await duckDb.connect() as unknown as AsyncDuckDBConnection

  return {
    query: async (query: vg.Query): Promise<Table | undefined>  => {
      const { sql, type } = query;
      // const result = await connection.evaluateStreamingQuery(sql);
      const bytes = await getMDArrowIPC(duckDbConn, sql)

      if (bytes) {
        switch (type) {
          case 'arrow':
            return decodeIPCToFlechette(bytes);
          case 'json':
            // return Array.from(await decodeIPCToFlechette(bytes));
            throw new Error('No JSON queries today, arrow only')
          default:
          case 'exec':
            return undefined;
        }
      } else {
        return undefined
      }
    },
  };
}

//@ts-expect-error unused
async function logDBMeta(connectToMotherDuck: boolean) {
  const versionResult = await vg.coordinator().query(`PRAGMA version`);
  const platformResult = await vg.coordinator().query(`PRAGMA platform`);
  const sizeResult = await vg.coordinator().query(`PRAGMA database_size`);

  if (connectToMotherDuck) {
    console.info("MotherDuck database info", {
      version: JSON.parse(String(versionResult)),
      platform: JSON.parse(String(platformResult)),
      size: JSON.parse(String(sizeResult)),
    });
    
  } else {
    console.info("Local DuckDB Wasm database info", {
      //@ts-expect-error variable has type 'unknown'
      version: versionResult.toArray(),
      //@ts-expect-error variable has type 'unknown'
      platform: platformResult.toArray(),
      //@ts-expect-error variable has type 'unknown'
      size: sizeResult.toArray(),
    });
  }
}

function App() {
  const [connected, setConnected] = useState(false)

  const connect = useCallback(async () => {
    if (CONNECT_TO_MOTHERDUCK) {
      const connector = await mdConnector(TOKEN)
      vg.coordinator().databaseConnector(connector);
      
    } else {
      const wasmDuckDbConnector = await vg.wasmConnector()
      vg.coordinator().databaseConnector(wasmDuckDbConnector);
    }

    // await logDBMeta(CONNECT_TO_MOTHERDUCK)
    setConnected(true)
  }, [])

  connect()

  return (
    <>
      <div>
        <h1> App UI </h1>

        { connected ?
          <div>
            <h2> Plots </h2>
            {/* <TextWidget /> */}
            <LinePlot connectToMotherDuck={CONNECT_TO_MOTHERDUCK} />
          </div>
          :
          <div>
            <h2> Connecting... </h2>
          </div>
        }
      </div>
    </>
  )
}

export default App
