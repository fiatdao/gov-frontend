import { useEffect, useState } from 'react';
import BigNumber from 'bignumber.js';
import { isMobile } from 'react-device-detect';
import { Progress } from 'antd';
import cn from 'classnames';
import format from 'date-fns/format';

import Grid from 'components/custom/grid';
import Icon from 'components/custom/icon';
import { Text } from 'components/custom/typography';
import { useGeneral } from 'components/providers/general-provider';
import iconNotConnect from 'resources/svg/not-connected.svg';
import { useWallet } from 'wallets/wallet';
import { formatBigValue } from 'web3/utils';

import { PrizesData } from '../prizes-view';
import { ACTIVE_KEY } from '../../views/age-of-romulus';
import { APIVoterEntity } from '../../api';

import s from './s.module.scss';

interface IAgeOfRomulusRank {
  allUsers: null | any[]
  currUser: null | undefined | APIVoterEntity
  countAllUsers: null | number
}

const AgeOfRomulusRank = ({ allUsers, currUser, countAllUsers }: IAgeOfRomulusRank) => {
  const wallet = useWallet();
  const { isDarkTheme } = useGeneral();

  const [nextPrize] = useState(() => {
    const nextPrizeIndex = PrizesData.map((i: any) => i.key).indexOf(ACTIVE_KEY);
    return  PrizesData[nextPrizeIndex ? nextPrizeIndex - 1 : nextPrizeIndex]
  })

  const [isUntil, setIsUntil] = useState(false)
  const [lastVoterWithPrize, setLastVoterWithPrize] = useState(() => new BigNumber(0))

  useEffect(() => {
    if(allUsers && countAllUsers && currUser) {
      const arrForPrize = [...allUsers]
      arrForPrize.splice(Math.ceil((countAllUsers) * ((nextPrize.rate as number) / 100)))
      setLastVoterWithPrize(arrForPrize[arrForPrize.length - 1].votingPower)

    }
  }, [allUsers, countAllUsers, currUser])

  useEffect(() => {
    if(lastVoterWithPrize.isGreaterThan(new BigNumber(0))) {
      setIsUntil(lastVoterWithPrize.isGreaterThan((currUser as APIVoterEntity).votingPower))
    }
  } , [lastVoterWithPrize])

  return (
    <div className={s.dots}>
      {!wallet.isActive ? (
        <div className="flex full-height justify-center align-center">
          <div className="flex flow-row align-center">
            <img src={iconNotConnect} width={48} height={64} className="mb-32" alt="" />
            <Text tag="p" type="p2" color="primary" className="mb-32">
              Wallet not connected: To check your rank, <br />
              connect your wallet below
            </Text>
            <button
              type="button"
              className={cn('button-primary', { 'button-small': isMobile })}
              onClick={() => wallet.showWalletsModal()}>
              <span>Connect {!isMobile && 'wallet'}</span>
            </button>
          </div>
        </div>
      ) : !!currUser && (
        <div>
          <div className={s.rank}>
            <Text type="p3" color="primary" className="mb-8">
              Your rank:
            </Text>
            <Text tag="p" type="h1" weight="bold" color="primary" className="mb-16">
              #{currUser.rank}
            </Text>
            <div className="flex inline flow-col align-center mb-32">
              <Icon name="png/fiat-dao" width={16} height={16} className="mr-4" />
              <Text type="p2" color="primary">
                vFDT  {formatBigValue(currUser.votingPower, 2, '-', 2)}
              </Text>
            </div>
          </div>
          <div className={s.rewards}>
            <div className={s.line} />
            <Text tag="p" weight="500" type="p2">
              Rewards
            </Text>
            <div className={s.line} />
          </div>
          <div className={s.upcoming}>
            <Grid flow="col" justify="space-between" className="1fr 1fr">
              <Text tag="p" type="p2" color="primary" className="mb-9">
                Next prize
              </Text>
              <Text tag="p" type="p2" color="primary" className="mb-9">
                {format(new Date(nextPrize.date), 'dd')} {format(new Date(nextPrize.date), 'LLL')}, {format(new Date(nextPrize.date), 'y')}
              </Text>
            </Grid>
            <div
              className={cn(s.upcoming__card, { [s.upcoming__card__active]: !isUntil })}>
              <Grid flow="col" gap={8} align="center" colsTemplate="60px 1fr">
                {nextPrize.icon}
                <div>
                  <Text type="lb2" color="primary">
                    {nextPrize.title}
                  </Text>
                  <Text type="p3" weight="bold" color="primary">
                    {nextPrize.rate ? `Top ${nextPrize.rate}%` : 'Everyone'}
                  </Text>
                </div>
              </Grid>
            </div>
          </div>
          <div className="progress">
            <Text type="p3" color="primary" className="mb-12">
              {isUntil
                ? `Until next prize: ${formatBigValue(lastVoterWithPrize.minus(currUser.votingPower), 2, '-', 2)} vFDT`
                : `You are ahead by: ${formatBigValue(currUser.votingPower.minus(lastVoterWithPrize), 2, '-', 2)} vFDT`}
            </Text>
            <Progress
              strokeColor={{
                '0%': '#FF9574',
                '100%': '#FF4C8C',
              }}
              trailColor={isDarkTheme ? '#171717' : '#F9F9F9'}
              percent={isUntil ? currUser.votingPower.times(new BigNumber(100)).div(lastVoterWithPrize).toNumber() : 100}
              strokeWidth={32}
              showInfo={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgeOfRomulusRank;
