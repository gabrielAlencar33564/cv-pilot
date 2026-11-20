import type { FunnelCounts } from '@cv-pilot/contracts';
import { Table, Text, Tooltip } from '@mantine/core';

/** Abaixo disso a taxa oscila demais para comparar currículos ou sites. */
const MIN_SAMPLE = 5;

/** Parte sobre o total, arredondada; sem total não há taxa. */
export const percent = (part: number, total: number) =>
  total === 0 ? '—' : `${Math.round((part / total) * 100)}%`;

/** "40% (2)": a taxa sobre as enviadas e quantas foram. */
function Rate({ part, total }: { part: number; total: number }) {
  const text = `${percent(part, total)} (${part})`;
  if (total >= MIN_SAMPLE) return <>{text}</>;
  return (
    <Tooltip label={`Poucos envios (menos de ${MIN_SAMPLE}): a taxa ainda pode mudar muito`}>
      <Text span c="dimmed" inherit>
        {text}
      </Text>
    </Tooltip>
  );
}

export interface FunnelRow extends FunnelCounts {
  key: string;
  /** uma célula por coluna de identificação (currículo, site...) */
  labels: string[];
}

/** Tabela do funil (RF-63): enviadas e a taxa de cada etapa sobre as enviadas. */
export function FunnelTable({ columns, rows }: { columns: string[]; rows: FunnelRow[] }) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c}>{c}</Table.Th>
            ))}
            <Table.Th>Enviadas</Table.Th>
            <Table.Th>Respostas</Table.Th>
            <Table.Th>Entrevistas</Table.Th>
            <Table.Th>Ofertas</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.key}>
              {r.labels.map((label, i) => (
                <Table.Td key={columns[i]}>{label}</Table.Td>
              ))}
              <Table.Td>{r.sent}</Table.Td>
              <Table.Td>
                <Rate part={r.responded} total={r.sent} />
              </Table.Td>
              <Table.Td>
                <Rate part={r.interviews} total={r.sent} />
              </Table.Td>
              <Table.Td>
                <Rate part={r.offers} total={r.sent} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
