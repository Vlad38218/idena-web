/* eslint-disable react/prop-types */
import {useMachine} from '@xstate/react'
import {useMemo, useEffect} from 'react'
import {useRouter} from 'next/router'
import {useTranslation} from 'react-i18next'
import {
  Flex,
  Text,
  IconButton,
  Heading,
  Stack,
  useDisclosure,
} from '@chakra-ui/react'
import {InfoIcon} from '@chakra-ui/icons'
import {
  createValidationMachine,
  RelevanceType,
} from '../../screens/validation/machine'
import {
  persistValidationState,
  loadValidationState,
  filterRegularFlips,
  rearrangeFlips,
  decodedWithKeywords,
  availableReportsNumber,
  filterSolvableFlips,
} from '../../screens/validation/utils'
import {
  ValidationScene,
  ActionBar,
  Thumbnails,
  Header,
  Title,
  FlipChallenge,
  CurrentStep,
  Flip,
  ActionBarItem,
  Thumbnail,
  FlipWords,
  NavButton,
  QualificationActions,
  QualificationButton,
  WelcomeQualificationDialog,
  WelcomeKeywordsQualificationDialog,
  ValidationTimer,
  ValidationFailedDialog,
  SubmitFailedDialog,
  FailedFlipAnnotation,
  ReviewValidationDialog,
  BadFlipDialog,
  ReviewShortSessionDialog,
} from '../../screens/validation/components'
import theme, {rem} from '../../shared/theme'
import {AnswerType} from '../../shared/types'
import {PrimaryButton} from '../../shared/components/button'
import {useAuthState} from '../../shared/providers/auth-context'
import {useLocalStorageLogger} from '../../shared/utils/logs'
import {Tooltip} from '../../shared/components/components'
import {Tooltip as TooltipLegacy} from '../../shared/components/tooltip'
import {LayoutContainer} from '../../screens/app/components'
import Auth from '../../shared/components/auth'
import useNodeTiming from '../../shared/hooks/use-node-timing'
import {useEpoch} from '../../shared/providers/epoch-context'

export default function ValidationPage() {
  const epoch = useEpoch()
  const timing = useNodeTiming()
  const {auth, privateKey, coinbase} = useAuthState()

  if (!auth) {
    return (
      <LayoutContainer>
        <Auth />
      </LayoutContainer>
    )
  }

  if (epoch && privateKey && coinbase && timing && timing.shortSession)
    return (
      <ValidationSession
        coinbase={coinbase}
        privateKey={privateKey}
        epoch={epoch.epoch}
        validationStart={new Date(epoch.nextValidation).getTime()}
        shortSessionDuration={timing.shortSession}
        longSessionDuration={timing.longSession}
      />
    )

  return null
}

function ValidationSession({
  privateKey,
  coinbase,
  epoch,
  validationStart,
  shortSessionDuration,
  longSessionDuration,
}) {
  const router = useRouter()

  const {t, i18n} = useTranslation()

  const info = useLocalStorageLogger(`logs-validation-${epoch}`)

  const {
    isOpen: isExceededTooltipOpen,
    onOpen: onOpenExceededTooltip,
    onClose: onCloseExceededTooltip,
  } = useDisclosure()
  const {
    isOpen: isReportDialogOpen,
    onOpen: onOpenReportDialog,
    onClose: onCloseReportDialog,
  } = useDisclosure()

  const validationMachine = useMemo(
    () =>
      createValidationMachine({
        privateKey,
        coinbase,
        epoch,
        validationStart,
        shortSessionDuration,
        longSessionDuration,
        locale: i18n.language || 'en',
      }),
    [
      coinbase,
      epoch,
      i18n.language,
      longSessionDuration,
      privateKey,
      shortSessionDuration,
      validationStart,
    ]
  )
  const [state, send] = useMachine(validationMachine, {
    actions: {
      onExceededReports: () => {
        onOpenExceededTooltip()
        setTimeout(onCloseExceededTooltip, 3000)
      },
      onValidationSucceeded: () => {
        router.push('/')
      },
    },
    state: loadValidationState(),
    logger: info,
  })

  const {
    currentIndex,
    translations,
    reportedFlipsCount,
    longFlips,
  } = state.context

  useEffect(() => {
    persistValidationState(state)
  }, [state])

  const flips = sessionFlips(state)
  const currentFlip = flips[currentIndex]

  return (
    <ValidationScene
      bg={isShortSession(state) ? theme.colors.black : theme.colors.white}
    >
      <Header>
        <Title color={isShortSession(state) ? 'white' : 'brandGray.500'}>
          {['shortSession', 'longSession'].some(state.matches) &&
          !isLongSessionKeywords(state)
            ? t('Select meaningful story: left or right', {nsSeparator: '!'})
            : t('Check flips quality')}
        </Title>
        <Flex align="center">
          <Title
            color={isShortSession(state) ? 'white' : 'brandGray.500'}
            mr={6}
          >
            {currentIndex + 1}{' '}
            <Text as="span" color="muted">
              {t('out of')} {flips.length}
            </Text>
          </Title>
        </Flex>
      </Header>
      <CurrentStep>
        <FlipChallenge>
          <Flex justify="center" align="center" position="relative">
            {currentFlip &&
              ((currentFlip.fetched && !currentFlip.decoded) ||
                currentFlip.failed) && (
                <FailedFlipAnnotation>
                  {t('No data available. Please skip the flip.')}
                </FailedFlipAnnotation>
              )}
            <Flip
              {...currentFlip}
              variant={AnswerType.Left}
              onChoose={hash =>
                send({
                  type: 'ANSWER',
                  hash,
                  option: AnswerType.Left,
                })
              }
            />
            <Flip
              {...currentFlip}
              variant={AnswerType.Right}
              onChoose={hash =>
                send({
                  type: 'ANSWER',
                  hash,
                  option: AnswerType.Right,
                })
              }
              onImageFail={() => send('REFETCH_FLIPS')}
            />
          </Flex>
          {(isLongSessionKeywords(state) ||
            state.matches('validationSucceeded')) &&
            currentFlip && (
              <FlipWords
                key={currentFlip.hash}
                currentFlip={currentFlip}
                translations={translations}
              >
                <Stack spacing={4}>
                  <Stack isInline spacing={1} align="center">
                    <Heading fontSize="base" fontWeight={500}>
                      {t(`Is the flip correct?`)}
                    </Heading>
                    <IconButton
                      icon={<InfoIcon />}
                      color="brandBlue.500"
                      bg="unset"
                      fontSize={rem(20)}
                      minW={5}
                      w={5}
                      h={5}
                      _active={{
                        bg: 'unset',
                      }}
                      _hover={{
                        bg: 'unset',
                      }}
                      _focus={{
                        outline: 'none',
                      }}
                      onClick={onOpenReportDialog}
                    />
                  </Stack>
                  <QualificationActions>
                    <QualificationButton
                      isSelected={
                        currentFlip.relevance === RelevanceType.Relevant
                      }
                      onClick={() =>
                        send({
                          type: 'TOGGLE_WORDS',
                          hash: currentFlip.hash,
                          relevance: RelevanceType.Relevant,
                        })
                      }
                    >
                      {t('Both relevant')}
                    </QualificationButton>
                    <Tooltip
                      label={t(
                        'Please remove Report status from some other flips to continue'
                      )}
                      isOpen={isExceededTooltipOpen}
                      placement="top"
                      zIndex="tooltip"
                    >
                      <QualificationButton
                        isSelected={
                          currentFlip.relevance === RelevanceType.Irrelevant
                        }
                        bg={
                          currentFlip.relevance === RelevanceType.Irrelevant
                            ? 'red.500'
                            : 'red.012'
                        }
                        color={
                          currentFlip.relevance === RelevanceType.Irrelevant
                            ? 'white'
                            : 'red.500'
                        }
                        _hover={null}
                        _active={null}
                        _focus={{
                          boxShadow: '0 0 0 3px rgb(255 102 102 /0.50)',
                          outline: 'none',
                        }}
                        onClick={() =>
                          send({
                            type: 'TOGGLE_WORDS',
                            hash: currentFlip.hash,
                            relevance: RelevanceType.Irrelevant,
                          })
                        }
                      >
                        {t('Report')}{' '}
                        {t('({{count}} left)', {
                          count:
                            availableReportsNumber(longFlips) -
                            reportedFlipsCount,
                        })}
                      </QualificationButton>
                    </Tooltip>
                  </QualificationActions>
                </Stack>
              </FlipWords>
            )}
        </FlipChallenge>
      </CurrentStep>
      <ActionBar>
        <ActionBarItem />
        <ActionBarItem justify="center">
          <ValidationTimer
            validationStart={validationStart}
            duration={
              shortSessionDuration -
              10 +
              (isShortSession(state) ? 0 : longSessionDuration)
            }
          />
        </ActionBarItem>
        <ActionBarItem justify="flex-end">
          {(isShortSession(state) || isLongSessionKeywords(state)) && (
            <TooltipLegacy
              content={
                hasAllRelevanceMarks(state) || isLastFlip(state)
                  ? null
                  : t('Go to last flip')
              }
            >
              <PrimaryButton
                isDisabled={!canSubmit(state)}
                isLoading={isSubmitting(state)}
                loadingText={t('Submitting answers...')}
                onClick={() => send('SUBMIT')}
              >
                {t('Submit answers')}
              </PrimaryButton>
            </TooltipLegacy>
          )}
          {isLongSessionFlips(state) && (
            <PrimaryButton
              isDisabled={!canSubmit(state)}
              onClick={() => send('FINISH_FLIPS')}
            >
              {t('Start checking keywords')}
            </PrimaryButton>
          )}
        </ActionBarItem>
      </ActionBar>
      <Thumbnails currentIndex={currentIndex}>
        {flips.map((flip, idx) => (
          <Thumbnail
            key={flip.hash}
            {...flip}
            isCurrent={currentIndex === idx}
            onPick={() => send({type: 'PICK', index: idx})}
          />
        ))}
      </Thumbnails>
      {!isFirstFlip(state) &&
        hasManyFlips(state) &&
        isSolving(state) &&
        !isSubmitting(state) && (
          <NavButton
            type="prev"
            bg={
              isShortSession(state) ? theme.colors.white01 : theme.colors.gray
            }
            color={
              isShortSession(state) ? theme.colors.white : theme.colors.text
            }
            onClick={() => send({type: 'PREV'})}
          />
        )}
      {!isLastFlip(state) &&
        hasManyFlips(state) &&
        isSolving(state) &&
        !isSubmitting(state) && (
          <NavButton
            type="next"
            bg={
              isShortSession(state) ? theme.colors.white01 : theme.colors.gray
            }
            color={
              isShortSession(state) ? theme.colors.white : theme.colors.text
            }
            onClick={() => send({type: 'NEXT'})}
          />
        )}
      {isSubmitFailed(state) && (
        <SubmitFailedDialog isOpen onSubmit={() => send('RETRY_SUBMIT')} />
      )}

      {state.matches('longSession.solve.answer.welcomeQualification') && (
        <WelcomeQualificationDialog
          isOpen
          onSubmit={() => send('START_LONG_SESSION')}
        />
      )}
      {state.matches('longSession.solve.answer.finishFlips') && (
        <WelcomeKeywordsQualificationDialog
          isOpen
          onSubmit={() => send('START_KEYWORDS_QUALIFICATION')}
        />
      )}

      {state.matches('validationFailed') && (
        <ValidationFailedDialog isOpen onSubmit={() => router.push('/')} />
      )}

      <BadFlipDialog
        isOpen={
          isReportDialogOpen ||
          state.matches('longSession.solve.answer.finishFlips')
        }
        title={t('The flip is to be reported')}
        subtitle={t(
          `You'll get rewards for reported flips if they are are also reported by more than 50% of qualification committee.`
        )}
        onClose={() => {
          if (state.matches('longSession.solve.answer.finishFlips'))
            send('START_KEYWORDS_QUALIFICATION')
          else onCloseReportDialog()
        }}
      />

      <ReviewValidationDialog
        flips={filterSolvableFlips(flips)}
        reportedFlipsCount={reportedFlipsCount}
        availableReportsCount={availableReportsNumber(longFlips)}
        isOpen={state.matches('longSession.solve.answer.review')}
        isSubmitting={isSubmitting(state)}
        onSubmit={() => send('SUBMIT')}
        onMisingAnswers={() => {
          send({
            type: 'CHECK_FLIPS',
            index: flips.findIndex(({option = 0}) => option < 1),
          })
        }}
        onMisingReports={() => {
          send('CHECK_REPORTS')
        }}
        onCancel={() => {
          send('CANCEL')
        }}
      />

      <ReviewShortSessionDialog
        flips={filterSolvableFlips(flips)}
        isOpen={state.matches(
          'shortSession.solve.answer.submitShortSession.confirm'
        )}
        onSubmit={() => send('SUBMIT')}
        onClose={() => {
          send('CANCEL')
        }}
        onCancel={() => {
          send('CANCEL')
        }}
      />
    </ValidationScene>
  )
}

function isShortSession(state) {
  return state.matches('shortSession')
}

function isLongSessionFlips(state) {
  return ['flips', 'finishFlips']
    .map(substate => `longSession.solve.answer.${substate}`)
    .some(state.matches)
}

function isLongSessionKeywords(state) {
  return ['keywordsQualification', 'submitAnswers']
    .map(substate => `longSession.solve.answer.${substate}`)
    .some(state.matches)
}

function isSolving(state) {
  return ['shortSession', 'longSession'].some(state.matches)
}

function isSubmitting(state) {
  return [
    'shortSession.solve.answer.submitShortSession.submitHash',
    'longSession.solve.answer.finishFlips',
    'longSession.solve.answer.submitAnswers',
  ].some(state.matches)
}

function isSubmitFailed(state) {
  return [
    ['shortSession', 'submitShortSession'],
    ['longSession', 'submitAnswers'],
  ]
    .map(([state1, state2]) => `${state1}.solve.answer.${state2}.fail`)
    .some(state.matches)
}

function isFirstFlip(state) {
  return ['shortSession', 'longSession']
    .map(substate => `${substate}.solve.nav.firstFlip`)
    .some(state.matches)
}

function isLastFlip(state) {
  return ['shortSession', 'longSession']
    .map(type => `${type}.solve.nav.lastFlip`)
    .some(state.matches)
}

function hasManyFlips(state) {
  return sessionFlips(state).length > 1
}

function canSubmit(state) {
  if (isShortSession(state) || isLongSessionFlips(state))
    return (hasAllAnswers(state) || isLastFlip(state)) && !isSubmitting(state)

  if (isLongSessionKeywords(state))
    return (
      (hasAllRelevanceMarks(state) || isLastFlip(state)) && !isSubmitting(state)
    )
}

function sessionFlips(state) {
  const {
    context: {shortFlips, longFlips},
  } = state
  return isShortSession(state)
    ? rearrangeFlips(filterRegularFlips(shortFlips))
    : rearrangeFlips(
        longFlips.filter(({decoded, missing}) => decoded || !missing)
      )
}

function hasAllAnswers(state) {
  const {
    context: {shortFlips, longFlips},
  } = state
  const flips = isShortSession(state)
    ? shortFlips.filter(({decoded, extra}) => decoded && !extra)
    : longFlips.filter(({decoded}) => decoded)
  return flips.length && flips.every(({option}) => option)
}

function hasAllRelevanceMarks({context: {longFlips}}) {
  const flips = longFlips.filter(decodedWithKeywords)
  return flips.every(({relevance}) => relevance)
}
