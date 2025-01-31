import * as vg from "@uwdata/vgplot"
import * as arrow from 'apache-arrow';
import { MDConnection, QueryResult } from '@motherduck/wasm-client';
import { useCallback, useEffect, useState } from 'react';
import './App.css'

// Flip this flag to switch between using a local DuckDB Wasm instance in the 
//   browser and connecting to MotherDuck:
const CONNECT_TO_MOTHERDUCK = false

// A Read-Scaling (e.g. read only) MotherDuck token. Create an .env.local file and add VITE_MD_TOKEN='abc123'
const TOKEN = import.meta.env.VITE_MD_TOKEN

function LinePlot({ connectToMotherDuck }: { connectToMotherDuck: boolean }) {
    const [plot, setPlot] = useState<unknown | null>(null)

    useEffect(() => {
        async function buildPlot() {
            if (connectToMotherDuck) {
                // Confirming that we can SELECT successfully
                const results = await vg.coordinator().query('SELECT Complaints, Year FROM mosaic_examples.main.complaints LIMIT 10')
                console.info(String(results))
                
                // Confirming that we can DESCRIBE successfully
                const d1 = await vg.coordinator().query('DESCRIBE SELECT Complaints as column FROM mosaic_examples.main.complaints as source')
                console.info('d1', String(d1))
                
                // Uncomment line 41 and the error thrown by the plot changes to:
                //
                // hook.js:608 TypeError: data.toColumns is not a function
                //   at arrowToColumns (to-data-columns.js:35:35)
                //   at toDataColumns (to-data-columns.js:24:7)
                //   at ConnectedMark.queryResult (Mark.js:177:17)
                //   at Coordinator.js:207:24
                //
                // This seems correlated with the use of quotes in the DESCRIBE query.
                //
                // The query string used on line 41 was derived from field-info.js:71 by 
                //   stringifying the return value of `Query.describe` in the console
                //   while paused on a breakpoint:
                //
                // String(Query.describe(q))
                // > 'DESCRIBE SELECT "Complaints" AS "column" FROM "mosaic_examples"."main"."complaints" AS "source"'
                
                // const d2 = await vg.coordinator().query('DESCRIBE SELECT "Complaints" AS "column" FROM "mosaic_examples"."main"."complaints" AS "source"')
                // console.info('d2', String(d2))

                // The plot attempts to run DESCRIBE queries against the source columns but throws the following:
                //
                // field-info.js:75 Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'column_type')
                //   at getFieldInfo (field-info.js:75:19)
                //   at async Promise.all (:5173/index 1)
                //   at async queryFieldInfo (field-info.js:50:13)
                //   at async Coordinator.initializeClient (Coordinator.js:251:24)
                const plot = vg.plot(
                    vg.line(
                        vg.from('mosaic_examples.main.complaints'),
                        {
                            x: 'Year',
                            y: 'Complaints'
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

async function arrowTableFromResult(result: QueryResult) {
  if (result.type === 'streaming') {
    const batches = await result.arrowStream.readAll();
    const table = new arrow.Table(batches);
    return table;
  } else {
    throw Error('expected streaming result');
  }
}

async function mdConnector(token: string): Promise<vg.Connector> {
  const connection = MDConnection.create({
    mdToken: token,
  });

  return {
    query: async (query: vg.Query) => {
      const { sql, type } = query;
      const result = await connection.evaluateStreamingQuery(sql);
      switch (type) {
        case 'arrow':
          return arrowTableFromResult(result);
        case 'json':
          return Array.from(await arrowTableFromResult(result));
        default:
        case 'exec':
          return undefined;
      }
    },
  };
}

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

    await logDBMeta(CONNECT_TO_MOTHERDUCK)
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
