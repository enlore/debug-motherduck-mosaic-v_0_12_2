declare module "geo-albers-usa-territories";

declare module "@uwdata/vgplot" {
  // core

  interface Query {
    sql: string;
    type: "exec" | "arrow" | "json";
  }

  class AsyncDispatch {
    addEventListener(type: unknown, callback: (...args: unknown[]) => unknown);
  }

  class Param extends AsyncDispatch {
    static value(arg0: number | Date);
    static array(arg: unknown[]);
  }

  class Selection extends Param {
    static crossfilter(): Selection;
    static single(): Selection;
    predicate(): object;
    value: unknown;
  }

  interface Connector {
    query(query: Query): Promise<unknown>;
  }

  class Coordinator {
    databaseConnector(connector: Connector): Connector;
    exec(query: string | string[]): Promise<void>;
    query(query: string | string[]): Promise<unknown>;
  }

  function coordinator(instance?: Coordinator): Coordinator;

  interface WASMConnectorOptions {
    log?: boolean;
  }

  function wasmConnector(options?: WASMConnectorOptions): Promise<Connector>;

  // sql

  class AggregateFunction {}

  function count(...args: unknown[]): AggregateFunction;

  function loadObjects(
    tableName: string,
    data: { [key: string]: unknown }[],
    options?: { replace?: boolean; temp?: boolean; view?: boolean },
  ): string;

  // inputs

  interface TableOptions {
    from: string; // Other types possible
    filterBy?: Selection;
    format?: { [column: string]: unknown };
    width?: number | { [column: string]: number };
    height?: number;
    align?: object;
    element?: Element;
  }

  function table(options: TableOptions): Element;

  // vgplot

  const Fixed: symbol;

  class Plot {}

  type Directive = (plot: Plot) => void;

  function plot(...directives: Directive[]): Element;

  // attributes
  function colorScheme(value: string): Directive;
  function colorScale(value: string): Directive;
  function colorLabel(value: string): Directive;
  function colorRange(value: string[]): Directive;
  function colorLegend(value?: string): Directive;
  function colorLegend(object): Element;

  function xyDomain(value: Fixed);
  function rDomain(value: Fixed);

  function name(value: string): Directive;
  function width(value: number): Directive;
  function height(value: number): Directive;
  function align(value: string): Directive;

  function margins(value: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): Directive;
  function marginTop(value: number): Directive;
  function marginRight(value: number): Directive;
  function marginBottom(value: number): Directive;
  function marginLeft(value: number): Directive;

  function xAxis(value: "top" | "bottom" | null): Directive;
  function xDomain(value: [number, number] | symbol): Directive;
  function xGrid(value: boolean): Directive;
  function xTickFormat(value: string | ((arg: number) => unkown)): Directive;
  function xTickRotate(value: number): Directive;
  function xLabel(value: string): Directive;

  function yAxis(value: "left" | "right" | null): Directive;
  function yDomain(value: [number, number] | symbol): Directive;
  function yGrid(value: boolean): Directive;
  function yTickFormat(value: string | ((arg: number) => unkown)): Directive;
  function yTickRotate(value: number): Directive;
  function yLabel(value: string): Directive;

  function style(value: string): Directive;
  function projectionType(value: string): Directive;
  function projectionRotate(value: string): Directive;
  function ruleY(value: number[] | { x: unknown }): Directive;
  function ruleX(value: number[] | { x: unknown }): Directive;

  function yNice(value: boolean): Directive;
  function xNice(value: boolean): Directive;

  // data
  function from(table: unknown, options?: unknown): unknown;

  // interactors
  function highlight(...args: unknown[]): Directive;
  function intervalX(...args: unknown[]): Directive;
  function toggle(...args: unknown[]): Directive;
  function toggleX(...args: unknown[]): Directive;
  function slider(...args: unknown[]): Directive;

  // marks
  function areaY(...args: unknown[]): Directive;
  function barY(...args: unknown[]): Directive;
  function contour(...args: unknown[]): Directive;
  function denseLine(...args: unknown[]): Directive;
  function dot(...args: unknown[]): Directive;
  function geo(...args: unknown[]): Directive;
  function hexbin(...args: unknown[]): Directive;
  function hexgrid(...args: unknown[]): Directive;
  function lineY(...args: unknown[]): Directive;
  function line(...args: unknown[]): Directive;
  function raster(...args: unknown[]): Directive;
  function rect(...args: unknown[]): Directive;
  function rectX(...args: unknown[]): Directive;
  function rectY(...args: unknown[]): Directive;
  function regressionY(...args: unknown[]): Directive;
  function sphere(...args: unknown[]): Directive;
  function text(...args: unknown[]): Directive;
  function textX(...args: unknown[]): Directive;
  function textY(...args: unknown[]): Directive;
  function tickY(...args: unknown[]): Directive;
  function nearestX({ as: unknown }): Directive;
  function axisX({
    lineWidth: number,
    tickRotate: number,
    tickPadding: number,
  }): Directive;
  function grid(value: boolean): Directive;

  // layout
  function hconcat(...elements: Element[]): Element;
  function hspace(value: number): Element;
  function vconcat(...elements: Element[]): Element;
  function vspace(value: number): Element;

  // transforms
  function bin(field: string): unknown;

  // misc
  function sql(strings: TemplateStringsArray): string;

  function centroidX(string): uknown;
  function centroidY(string): uknown;

  function menu(options: unkown): Element;
}
