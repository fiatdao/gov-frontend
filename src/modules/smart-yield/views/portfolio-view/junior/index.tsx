import React from 'react';
import format from 'date-fns/format';
import { formatBigValue, getHumanValue, ZERO_BIG_NUMBER } from 'web3/utils';
import * as Antd from 'antd';
import Button from 'components/antd/button';
import Card from 'components/antd/card';
import Tabs from 'components/antd/tabs';
import Tooltip from 'components/antd/tooltip';
import Grid from 'components/custom/grid';
import Icons from 'components/custom/icon';
import { Text } from 'components/custom/typography';
import { mergeState } from 'hooks/useMergeState';
import ConfirmTxModal, { ConfirmTxModalArgs } from 'modules/smart-yield/components/confirm-tx-modal';
import PortfolioBalance from 'modules/smart-yield/components/portfolio-balance';
import SYJuniorBondContract from 'modules/smart-yield/contracts/syJuniorBondContract';
import SYSmartYieldContract from 'modules/smart-yield/contracts/sySmartYieldContract';
import PoolsProvider, { PoolsSYPool, usePools } from 'modules/smart-yield/views/overview-view/pools-provider';
import { useWallet } from 'wallets/wallet';

import ActivePositionsTable, { ActivePositionsTableEntity } from './active-positions-table';
import LockedPositionsTable, { LockedPositionsTableEntity } from './locked-positions-table';
import PastPositionsTable from './past-positions-table';
import PortfolioValue from './portfolio-value';

import { doSequential } from 'utils';

import s from './s.module.scss';

type State = {
  loadingActive: boolean;
  dataActive: ActivePositionsTableEntity[];
  loadingLocked: boolean;
  dataLocked: LockedPositionsTableEntity[];
};

const InitialState: State = {
  loadingActive: false,
  dataActive: [],
  loadingLocked: false,
  dataLocked: [],
};

const JuniorPortfolioInner: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<string>('locked');

  const wallet = useWallet();
  const poolsCtx = usePools();

  const { pools } = poolsCtx;

  const [state, setState] = React.useState<State>(InitialState);
  const [redeemModal, setRedeemModal] = React.useState<LockedPositionsTableEntity | undefined>();

  React.useEffect(() => {
    if (!wallet.account) {
      return;
    }

    setState(
      mergeState<State>({
        loadingActive: true,
      }),
    );

    (async () => {
      const result = await doSequential<PoolsSYPool>(pools, async pool => {
        return new Promise<any>(async resolve => {
          const smartYieldContract = new SYSmartYieldContract(pool.smartYieldAddress);
          smartYieldContract.setProvider(wallet.provider);
          smartYieldContract.setAccount(wallet.account);

          const smartYieldBalance = await smartYieldContract.getBalance();
          const smartYieldAbond = await smartYieldContract.getAbond();

          if (smartYieldBalance.isGreaterThan(ZERO_BIG_NUMBER)) {
            resolve({
              ...pool,
              smartYieldBalance,
              smartYieldAbond,
            });
          } else {
            resolve(undefined);
          }
        });
      });

      setState(
        mergeState<State>({
          loadingActive: false,
          dataActive: result.filter(Boolean),
        }),
      );
    })();
  }, [wallet.account, pools]);

  React.useEffect(() => {
    if (!wallet.account) {
      return;
    }

    setState(
      mergeState<State>({
        loadingLocked: true,
      }),
    );

    (async () => {
      const result = await doSequential<PoolsSYPool>(pools, async pool => {
        return new Promise<any>(async resolve => {
          const juniorBondContract = new SYJuniorBondContract(pool.juniorBondAddress);
          juniorBondContract.setProvider(wallet.provider);
          juniorBondContract.setAccount(wallet.account);

          const jBondIds = await juniorBondContract.getJuniorBondIds();

          if (jBondIds.length === 0) {
            return resolve(undefined);
          }

          const smartYieldContract = new SYSmartYieldContract(pool.smartYieldAddress);
          smartYieldContract.setProvider(wallet.provider);

          const jBonds = await smartYieldContract.getJuniorBonds(jBondIds);

          if (jBonds.length === 0) {
            return resolve(undefined);
          }

          const items = jBonds.map(jBond => {
            const item = {
              pool,
              jBond,
              redeem: () => {
                setRedeemModal(item);
              },
            };

            return item;
          });

          resolve(items);
        });
      });

      setState(
        mergeState<State>({
          loadingLocked: false,
          dataLocked: result.flat().filter(Boolean),
        }),
      );
    })();
  }, [wallet.account, pools]);

  function handleRedeemCancel() {
    setRedeemModal(undefined);
  }

  function handleRedeemConfirm(args: ConfirmTxModalArgs): Promise<void> {
    if (!redeemModal) {
      return Promise.reject();
    }

    const { pool, jBond } = redeemModal;

    const contract = new SYSmartYieldContract(pool.smartYieldAddress);
    contract.setProvider(wallet.provider);
    contract.setAccount(wallet.account);

    return contract.redeemJuniorBondSend(jBond.jBondId, args.gasPrice).then(() => {
      // reload();
    });
  }

  const activeBalance = state.dataActive?.reduce((a, c) => {
    return a.plus(getHumanValue(c.smartYieldBalance, c.underlyingDecimals)?.multipliedBy(1) ?? ZERO_BIG_NUMBER); /// price
  }, ZERO_BIG_NUMBER);

  const lockedBalance = state.dataLocked?.reduce((a, c) => {
    return a.plus(getHumanValue(c.jBond.tokens, c.pool.underlyingDecimals)?.multipliedBy(1) ?? ZERO_BIG_NUMBER); /// price
  }, ZERO_BIG_NUMBER);

  const apy = state.dataActive[0]?.state.juniorApy; /// calculate by formula

  const totalBalance = activeBalance?.plus(lockedBalance ?? ZERO_BIG_NUMBER);

  return (
    <>
      <div className={s.portfolioContainer}>
        <Antd.Spin spinning={state.loadingActive || state.loadingLocked}>
          <PortfolioBalance
            total={totalBalance?.toNumber()}
            aggregated={apy * 100}
            aggregatedColor="purple"
            data={[
              ['Active balance ', activeBalance?.toNumber(), 'var(--theme-purple700-color)'],
              ['Locked balance', lockedBalance?.toNumber(), 'var(--theme-purple-color)'],
            ]}
          />
        </Antd.Spin>
        <PortfolioValue />
      </div>
      <Card className="mb-32" noPaddingBody>
        <Tabs
          simple
          className={s.tabs}
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            <Button type="light">
              <Icons name="filter" />
              Filter
            </Button>
          }>
          <Tabs.Tab key="locked" tab="Locked positions">
            <LockedPositionsTable loading={state.loadingLocked} data={state.dataLocked} />
            {redeemModal && (
              <ConfirmTxModal
                visible
                title="Redeem your junior bond"
                header={
                  <div className="grid flow-col col-gap-32">
                    <div className="grid flow-row row-gap-4">
                      <Text type="small" weight="semibold" color="secondary">
                        Redeemable balance
                      </Text>
                      <Tooltip
                        title={formatBigValue(
                          getHumanValue(redeemModal.jBond.tokens, redeemModal.pool.underlyingDecimals),
                          redeemModal.pool.underlyingDecimals,
                        )}>
                        <Text type="p1" weight="semibold" color="primary">
                          {formatBigValue(getHumanValue(redeemModal.jBond.tokens, redeemModal.pool.underlyingDecimals))}
                        </Text>
                      </Tooltip>
                    </div>
                    <div className="grid flow-row row-gap-4">
                      <Text type="small" weight="semibold" color="secondary">
                        Maturity date
                      </Text>
                      <Text type="p1" weight="semibold" color="primary">
                        {format(redeemModal.jBond.maturesAt * 1_000, 'dd.MM.yyyy')}
                      </Text>
                    </div>
                  </div>
                }
                submitText="Redeem"
                onCancel={handleRedeemCancel}
                onConfirm={handleRedeemConfirm}
              />
            )}
          </Tabs.Tab>
          <Tabs.Tab key="past" tab="Past positions">
            <PastPositionsTable />
          </Tabs.Tab>
        </Tabs>
      </Card>
      <Card
        noPaddingBody
        title={
          <Grid flow="col" colsTemplate="1fr max-content">
            <Text type="p1" weight="semibold" color="primary">
              Active positions
            </Text>
            <Button type="light">
              <Icons name="filter" />
              Filter
            </Button>
          </Grid>
        }>
        <ActivePositionsTable loading={state.loadingActive} data={state.dataActive} />
      </Card>
    </>
  );
};

const JuniorPortfolio: React.FC = () => {
  return (
    <PoolsProvider>
      <JuniorPortfolioInner />
    </PoolsProvider>
  );
};

export default JuniorPortfolio;