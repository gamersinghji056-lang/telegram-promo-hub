import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type GrowthLineChartProps = {
  data: unknown[];
  series: string[];
};

export function GrowthLineChart({ data, series }: GrowthLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) =>
            new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          }
          minTickGap={24}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <YAxis axisLine={false} tickLine={false} width={42} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          labelFormatter={(value) => new Date(value as string).toLocaleString()}
        />
        {series.includes("memberCount") ? (
          <Line
            type="linear"
            dataKey="memberCount"
            name="Members"
            stroke="var(--chart-1)"
            strokeWidth={2.25}
            connectNulls={false}
            dot={data.length < 12}
          />
        ) : null}
        {series.includes("joins") ? (
          <Line type="linear" dataKey="joins" name="Joins" stroke="var(--success)" strokeWidth={2} connectNulls={false} dot={false} />
        ) : null}
        {series.includes("leaves") ? (
          <Line type="linear" dataKey="leaves" name="Leaves" stroke="var(--destructive)" strokeWidth={2} connectNulls={false} dot={false} />
        ) : null}
        {series.includes("netGrowth") ? (
          <Line type="linear" dataKey="netGrowth" name="Net Growth" stroke="var(--chart-2)" strokeWidth={2} connectNulls={false} dot={false} />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default GrowthLineChart;
