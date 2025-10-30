
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const AttendanceBarChart: React.FC<{data: any[]}> = ({ data }) => {
  const bars = data.length > 0 ? Object.keys(data[0]).filter(key => key !== 'name') : [];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        {bars.map((bar, index) => (
             <Bar key={bar} dataKey={bar} fill={COLORS[index % COLORS.length]} name={bar} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export const RequestStatusPieChart: React.FC<{data: any[]}> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          // FIX: The 'percent' prop can be undefined. Coalesce to 0 and cast to number to prevent runtime errors during multiplication.
          label={({ name, percent }) => `${name} ${(((percent || 0) as number) * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const LatenessLineChart: React.FC<{data: any[]}> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="minutes" stroke="#ff7300" name="مجموع دقائق التأخير" />
            </LineChart>
        </ResponsiveContainer>
    );
};
