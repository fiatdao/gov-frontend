import React from 'react';
import { ColumnsType } from 'antd/lib/table/interface';
import { formatDistance } from 'date-fns';
import BigNumber from 'bignumber.js';
import capitalize from 'lodash/capitalize';

import Button from 'components/antd/button';
import Card from 'components/antd/card';
import Select, { SelectOption } from 'components/antd/select';
import Table from 'components/antd/table';
import Tooltip from 'components/antd/tooltip';
import ExternalLink from 'components/custom/externalLink';
import Grid from 'components/custom/grid';
import { Paragraph } from 'components/custom/typography';
import PoolTxListProvider, {
  PoolTxListItem,
  usePoolTxList,
} from 'modules/yield-farming/providers/pool-tx-list-provider';
import { PoolActions, PoolTypes } from 'modules/yield-farming/utils';

import { useWallet } from 'wallets/wallet';
import { useWeb3Contracts } from 'web3/contracts';
import { BONDTokenMeta } from 'web3/contracts/bond';
import { DAITokenMeta } from 'web3/contracts/dai';
import { SUSDTokenMeta } from 'web3/contracts/susd';
import { UNISWAPTokenMeta } from 'web3/contracts/uniswap';
import { USDCTokenMeta } from 'web3/contracts/usdc';
import { formatBigValue, formatUSDValue, getEtherscanTxUrl, getTokenMeta, shortenAddr, } from 'web3/utils';

import { ReactComponent as EmptyBoxSvg } from 'resources/svg/empty-box.svg';

import s from './styles.module.scss';

const TypeFilters: SelectOption[] = [
  { value: 'all', label: 'All transactions' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
];

const Columns: ColumnsType<any> = [
  {
    title: '',
    dataIndex: 'token',
    width: 24,
    // render: (value: string) => getTokenMeta(value)?.icon,
  },
  {
    title: 'From',
    dataIndex: 'user',
    render: (value: string) => (
      <Paragraph type="p1" semiBold color="primary">
        {shortenAddr(value)}
      </Paragraph>
    ),
  },
  {
    title: 'TX Hash',
    dataIndex: 'txHash',
    render: (value: string) => (
      <ExternalLink href={getEtherscanTxUrl(value)}>
        <Paragraph type="p1" semiBold color="blue">
          {shortenAddr(value)}
        </Paragraph>
      </ExternalLink>
    ),
  },
  {
    title: 'Time',
    dataIndex: 'blockTimestamp',
    render: (value: number) => (
      <Paragraph type="p1" semiBold color="primary">
        {formatDistance(new Date(value * 1_000), new Date(), {
          addSuffix: true,
        })}
      </Paragraph>
    ),
  },
  {
    title: 'Amount',
    dataIndex: 'usdAmount',
    align: 'right',
    render: (value: BigNumber, record: PoolTxListItem) => {
      const tokenMeta = getTokenMeta(record.token);

      return (
        <Tooltip
          title={
            <span>
              <strong>{formatBigValue(record.amount)}</strong>&nbsp;
              {tokenMeta?.name}
            </span>
          }>
          <Paragraph type="p1" semiBold color="primary">
            {formatUSDValue(value)}
          </Paragraph>
        </Tooltip>
      );
    },
  },
  {
    title: 'Type',
    dataIndex: 'type',
    render: (value: string) => (
      <Paragraph type="p1" semiBold color="primary">
        {capitalize(value)}
      </Paragraph>
    ),
  },
];

export type PoolTxTableProps = {
  label: string;
  ownTransactions?: boolean;
  pool?: PoolTypes;
  action?: PoolActions;
};

const PoolTxTableInner: React.FunctionComponent<PoolTxTableProps> = props => {
  const { label, ownTransactions, pool, action } = props;

  const wallet = useWallet();
  const web3c = useWeb3Contracts();
  const poolTxList = usePoolTxList();

  React.useEffect(() => {
    poolTxList.changeUserFilter(ownTransactions ? wallet.account : undefined);

    poolTxList.changeTokenFilter(undefined);

    if (action === PoolActions.DEPOSIT) {
      poolTxList.changeTypeFilter('deposits');
    } else if (action === PoolActions.WITHDRAW) {
      poolTxList.changeTypeFilter('withdrawals');
    } else {
      poolTxList.changeTypeFilter(undefined);
    }
  }, []);

  const tokenFilterOptions = React.useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [];

    if ((pool ?? PoolTypes.STABLE) === PoolTypes.STABLE) {
      options.push(
        {
          value: USDCTokenMeta.address,
          label: USDCTokenMeta.name,
        },
        {
          value: DAITokenMeta.address,
          label: DAITokenMeta.name,
        },
        {
          value: SUSDTokenMeta.address,
          label: SUSDTokenMeta.name,
        },
      );
    }

    if ((pool ?? PoolTypes.UNILP) === PoolTypes.UNILP) {
      options.push({
        value: UNISWAPTokenMeta.address,
        label: UNISWAPTokenMeta.name,
      });
    }

    if ((pool ?? PoolTypes.BOND) === PoolTypes.BOND) {
      options.push({
        value: BONDTokenMeta.address,
        label: BONDTokenMeta.name,
      });
    }

    if (options.length !== 1) {
      options.unshift({
        value: 'all',
        label: 'All tokens',
      });
    }

    return options;
  }, [pool]);

  const tableData = React.useMemo<(PoolTxListItem & { usdAmount: BigNumber | undefined })[]>(() => {
    return poolTxList.transactions.map(tx => {
      const price = web3c.getTokenUsdPrice(tx.token);

      return {
        ...tx,
        usdAmount: price ? tx.amount.multipliedBy(price) : undefined,
      };
    });
  }, [web3c, poolTxList.transactions]);

  const CardTitle = (
    <Grid flow="col" align="center" justify="space-between">
      <Paragraph type="p1" semiBold color="primary">
        {label}
      </Paragraph>
      <Grid flow="col" gap={24}>
        <Select
          label="Tokens"
          options={tokenFilterOptions}
          value={poolTxList.tokenFilter ?? 'all'}
          disabled={poolTxList.loading}
          onSelect={(value: string) => {
            poolTxList.changeTokenFilter(value !== 'all' ? value : undefined);
          }}
        />
        <Select
          label="Show"
          options={TypeFilters}
          value={poolTxList.typeFilter ?? 'all'}
          disabled={poolTxList.loading}
          onSelect={(value: string) => {
            poolTxList.changeTypeFilter(value !== 'all' ? value : undefined);
          }}
        />
      </Grid>
    </Grid>
  );

  const CardEmptyText = (
    <Grid flow="row" gap={16} align="center" padding={[54, 0]}>
      <EmptyBoxSvg />
      <Paragraph type="p1" color="secondary">
        There are no transactions to show
      </Paragraph>
    </Grid>
  );

  const CardFooter = (
    <Grid align="center" justify="center">
      <Button
        type="light"
        disabled={poolTxList.loading}
        onClick={poolTxList.loadNext}>
        Load more transactions
      </Button>
    </Grid>
  );

  return (
    <Card title={CardTitle} noPaddingBody className={s.table}>
      <Table<PoolTxListItem>
        columns={Columns}
        rowKey="txHash"
        dataSource={tableData}
        loading={!poolTxList.loaded && poolTxList.loading}
        locale={{
          emptyText: CardEmptyText,
        }}
        footer={() => !poolTxList.isEnd && CardFooter}
      />
    </Card>
  );
};

const PoolTxTable: React.FunctionComponent<PoolTxTableProps> = props => (
  <PoolTxListProvider>
    <PoolTxTableInner {...props} />
  </PoolTxListProvider>
);

export default PoolTxTable;