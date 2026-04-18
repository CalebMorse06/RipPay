import React, {useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  Dimensions,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {Colors, Typography, Radius} from '../theme';

const SCAN_SIZE = 260;
const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');
const SIDE_W = (SCREEN_W - SCAN_SIZE) / 2;
const TOP_H = (SCREEN_H - SCAN_SIZE) / 2 - 40;
const BOTTOM_H = SCREEN_H - TOP_H - SCAN_SIZE;

interface Props {
  visible: boolean;
  onScan: (raw: string) => void;
  onClose: () => void;
}

export default function QRScannerModal({visible, onScan, onClose}: Props) {
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const scannedRef = useRef(false);

  const handleCodeScanned = useCallback(
    (codes: {value?: string}[]) => {
      if (scannedRef.current) return;
      const value = codes[0]?.value;
      if (!value) return;
      scannedRef.current = true;
      onScan(value);
    },
    [onScan],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleCodeScanned,
  });

  // Reset scan lock when modal closes
  React.useEffect(() => {
    if (!visible) {
      scannedRef.current = false;
    }
  }, [visible]);

  // Request permission when modal opens
  React.useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  const renderContent = () => {
    if (!hasPermission) {
      return (
        <View style={styles.permissionWrap}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionBody}>
            Allow camera access to scan merchant QR codes.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelTextButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!device) {
      return (
        <View style={styles.permissionWrap}>
          <Text style={styles.permissionTitle}>Camera Unavailable</Text>
          <TouchableOpacity style={styles.cancelTextButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          codeScanner={codeScanner}
        />

        {/* Overlay — 4 masked regions around the scan window */}
        <View style={[styles.overlay, {top: 0, left: 0, right: 0, height: TOP_H}]} />
        <View style={[styles.overlay, {top: TOP_H, left: 0, width: SIDE_W, height: SCAN_SIZE}]} />
        <View style={[styles.overlay, {top: TOP_H, right: 0, width: SIDE_W, height: SCAN_SIZE}]} />
        <View style={[styles.overlay, {bottom: 0, left: 0, right: 0, height: BOTTOM_H}]} />

        {/* Scan frame corner brackets */}
        <View style={[styles.frame, {top: TOP_H, left: SIDE_W}]}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Label above frame */}
        <View style={[styles.labelWrap, {top: TOP_H - 44, left: SIDE_W, width: SCAN_SIZE}]}>
          <Text style={styles.label}>Point at the merchant's QR code</Text>
        </View>

        {/* Cancel below frame */}
        <View style={[styles.cancelWrap, {top: TOP_H + SCAN_SIZE + 28}]}>
          <TouchableOpacity onPress={onClose} hitSlop={{top: 16, bottom: 16, left: 32, right: 32}}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={styles.container}>{renderContent()}</View>
    </Modal>
  );
}

const BRACKET = 24;
const BRACKET_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  frame: {
    position: 'absolute',
    width: SCAN_SIZE,
    height: SCAN_SIZE,
  },
  corner: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
    borderBottomRightRadius: 4,
  },
  labelWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  label: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  cancelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: Typography.base,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  settingsButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  settingsButtonText: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelTextButton: {marginTop: 8},
});
